import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';

const TELEGRAM_BOT_TOKEN = '8386972393:AAGaDSB6gOt2YKtaeDXKmYf6fMOL6kCdO9k';
const TELEGRAM_CHAT_ID = '5831003572';

export const sendTelegramMessage = async (message: string): Promise<boolean> => {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'HTML',
        }),
      }
    );
    return response.ok;
  } catch (error) {
    console.error('Telegram send error:', error);
    return false;
  }
};

interface BranchSummary {
  branchName: string;
  hasEntry: boolean;
  totalTarget: number;
  totalAch: number;
  executiveCount: number;
}

export const formatSummaryReport = (
  date: string,
  summaries: BranchSummary[]
): string => {
  // Sort A-Z
  const sortedSummaries = [...summaries].sort((a, b) => a.branchName.localeCompare(b.branchName));
  const entered = sortedSummaries.filter(s => s.hasEntry);
  const notEntered = sortedSummaries.filter(s => !s.hasEntry);

  const totalTarget = entered.reduce((sum, s) => sum + s.totalTarget, 0);
  const totalAch = entered.reduce((sum, s) => sum + s.totalAch, 0);
  const overallPercent = totalTarget > 0 ? ((totalAch / totalTarget) * 100).toFixed(1) : '0';

  let message = `📊 <b>Daily Collection Report</b>\n`;
  message += `📅 Date: ${date}\n\n`;

  message += `✅ <b>Branches with Entry (${entered.length})</b>\n`;
  if (entered.length === 0) {
    message += `   No entries yet\n`;
  } else {
    entered.forEach(s => {
      const percent = s.totalTarget > 0 ? ((s.totalAch / s.totalTarget) * 100).toFixed(0) : '0';
      const emoji = Number(percent) >= 90 ? '🟢' : Number(percent) >= 70 ? '🟡' : '🔴';
      message += `   ${emoji} ${s.branchName}: ${s.totalAch}/${s.totalTarget} (${percent}%)\n`;
    });
  }

  message += `\n❌ <b>Branches without Entry (${notEntered.length})</b>\n`;
  if (notEntered.length === 0) {
    message += `   All branches have entered!\n`;
  } else {
    notEntered.forEach(s => {
      message += `   ⚠️ ${s.branchName}\n`;
    });
  }

  message += `\n📈 <b>Overall Summary</b>\n`;
  message += `   Total Target: ${totalTarget}\n`;
  message += `   Total ACH: ${totalAch}\n`;
  message += `   Achievement: ${overallPercent}%\n`;
  message += `   Branches Reported: ${entered.length}/${summaries.length}`;

  return message;
};

// Entry notification when branch manager saves data
interface EntryNotification {
  branchName: string;
  executiveName: string;
  date: string;
  targetQty: number;
  achQty: number;
  cashQty: number;
  isUpdate: boolean;
}

export const sendEntryNotification = async (entry: EntryNotification): Promise<boolean> => {
  const balance = entry.targetQty - entry.achQty;
  const percent = entry.targetQty > 0 ? ((entry.achQty / entry.targetQty) * 100).toFixed(1) : '0';
  const emoji = Number(percent) >= 90 ? '🟢' : Number(percent) >= 70 ? '🟡' : '🔴';
  const action = entry.isUpdate ? '✏️ Updated' : '📝 New Entry';

  let message = `${action}\n\n`;
  message += `🏢 <b>${entry.branchName}</b>\n`;
  message += `👤 Executive: ${entry.executiveName}\n`;
  message += `📅 Date: ${entry.date}\n\n`;
  message += `🎯 Target: ${entry.targetQty}\n`;
  message += `✅ ACH: ${entry.achQty}\n`;
  message += `💵 Cash: ${entry.cashQty}\n`;
  message += `📊 Balance: ${balance}\n`;
  message += `${emoji} Achievement: ${percent}%`;

  return sendTelegramMessage(message);
};


// Send branch status update - which branches entered and which didn't
export const sendBranchStatusUpdate = async (date: string): Promise<boolean> => {
  try {
    // Fetch all branches
    const branchSnapshot = await getDocs(collection(db, 'Branches'));
    const branches = branchSnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().branchName,
    }));

    if (branches.length === 0) return false;

    // Fetch today's collections
    const collectionsQuery = query(
      collection(db, 'dailyCollections'),
      where('date', '==', date)
    );
    const collectionsSnapshot = await getDocs(collectionsQuery);
    
    // Get unique branch IDs that have entries
    const branchesWithEntries = new Set<string>();
    const branchTotals = new Map<string, { target: number; ach: number }>();
    
    collectionsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      branchesWithEntries.add(data.branchId);
      
      const current = branchTotals.get(data.branchId) || { target: 0, ach: 0 };
      branchTotals.set(data.branchId, {
        target: current.target + (data.targetQty || 0),
        ach: current.ach + (data.achQty || 0),
      });
    });

    // Separate entered and not entered, then sort A-Z
    const entered: { name: string; target: number; ach: number }[] = [];
    const notEntered: string[] = [];

    branches.forEach(branch => {
      if (branchesWithEntries.has(branch.id)) {
        const totals = branchTotals.get(branch.id) || { target: 0, ach: 0 };
        entered.push({ name: branch.name, ...totals });
      } else {
        notEntered.push(branch.name);
      }
    });

    // Sort both lists A-Z
    entered.sort((a, b) => a.name.localeCompare(b.name));
    notEntered.sort((a, b) => a.localeCompare(b));

    // Calculate totals
    const totalTarget = entered.reduce((sum, b) => sum + b.target, 0);
    const totalAch = entered.reduce((sum, b) => sum + b.ach, 0);
    const overallPercent = totalTarget > 0 ? ((totalAch / totalTarget) * 100).toFixed(1) : '0';

    // Build message
    let message = `📋 <b>Entry Status Update</b>\n`;
    message += `📅 ${date}\n\n`;

    message += `✅ <b>Entered (${entered.length}/${branches.length})</b>\n`;
    if (entered.length === 0) {
      message += `   None yet\n`;
    } else {
      entered.forEach(b => {
        const pct = b.target > 0 ? ((b.ach / b.target) * 100).toFixed(0) : '0';
        const emoji = Number(pct) >= 90 ? '🟢' : Number(pct) >= 70 ? '🟡' : '🔴';
        message += `   ${emoji} ${b.name}: ${b.ach}/${b.target} (${pct}%)\n`;
      });
    }

    message += `\n❌ <b>Not Entered (${notEntered.length})</b>\n`;
    if (notEntered.length === 0) {
      message += `   ✨ All branches reported!\n`;
    } else {
      notEntered.forEach(name => {
        message += `   ⚠️ ${name}\n`;
      });
    }

    message += `\n📈 <b>Total: ${totalAch}/${totalTarget} (${overallPercent}%)</b>`;

    return sendTelegramMessage(message);
  } catch (error) {
    console.error('Error sending branch status:', error);
    return false;
  }
};
