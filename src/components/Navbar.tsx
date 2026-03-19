import { useState, useEffect } from 'react';
import { Menu, X, Code } from 'lucide-react';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setIsScrolled(scrollPosition > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-white shadow-md py-2' : 'bg-transparent py-4'
        }`}
    >
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <nav className="flex items-center justify-between">
          <div className="flex items-center">
            <a
              href="#"
              className="flex items-center text-xl font-bold text-indigo-900"
            >
              <Code className="h-6 w-6 mr-2 text-indigo-600" strokeWidth={2.5} />
              <span className={`transition-colors duration-300 ${isScrolled ? 'text-indigo-900' : 'text-white'}`}>
                Эрхэм Консалтинг
              </span>
            </a>
          </div>

          {/* Desktop Navigation */}
          <ul className="hidden md:flex space-x-8">
            {['Нүүр', 'Тайлан', 'Зарууд'].map((item) => (
              <li key={item}>
                <a
                  href={`#${item === 'Нүүр' ? 'home' : item === 'Тайлан' ? 'report' : 'listings'}`}
                  className={`transition-colors duration-300 hover:text-indigo-600 ${isScrolled ? 'text-gray-700' : 'text-white'
                    }`}
                >
                  {item}
                </a>
              </li>
            ))}
          </ul>

          {/* Mobile Navigation Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden focus:outline-none"
            aria-label="Toggle Menu"
          >
            {isOpen ? (
              <X className={`h-6 w-6 ${isScrolled ? 'text-gray-700' : 'text-white'}`} />
            ) : (
              <Menu className={`h-6 w-6 ${isScrolled ? 'text-gray-700' : 'text-white'}`} />
            )}
          </button>
        </nav>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-4 space-y-1 bg-white rounded-lg mt-2 shadow-lg">
              {['Нүүр', 'Тайлан', 'Зарууд'].map((item) => (
                <a
                  key={item}
                  href={`#${item === 'Нүүр' ? 'home' : item === 'Тайлан' ? 'report' : 'listings'}`}
                  className="block px-3 py-2 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-md"
                  onClick={() => setIsOpen(false)}
                >
                  {item}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
