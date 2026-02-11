export default function Footer() {
  return (
    <footer className="bg-gradient-to-r from-blue-600 to-blue-800 text-white mt-auto shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="text-center">
          <p className="text-base sm:text-lg font-bold tracking-wide">
            Developed By Md. Rezaul Karim - RCM (Tangail Area)
          </p>
          <p className="text-sm sm:text-base mt-2 font-medium opacity-95">
            © {new Date().getFullYear()} Daily Work Management. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
