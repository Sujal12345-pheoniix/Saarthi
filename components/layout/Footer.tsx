export default function Footer() {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-12">
      <div className="container mx-auto px-4 text-center">
        <p className="text-slate-500 dark:text-slate-400">
          &copy; {new Date().getFullYear()} Saarthi Wellness. All rights reserved.
        </p>
        <p className="text-sm text-slate-400 mt-2">
          Your personal AI wellness companion.
        </p>
      </div>
    </footer>
  );
}
