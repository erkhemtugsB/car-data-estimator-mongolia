import { Code, Facebook } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-gray-900 text-white pt-16 pb-8">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          <div>
            <div className="flex items-center mb-4">
              <Code className="h-8 w-8 text-navy-400 mr-2" strokeWidth={2.5} />
              <span className="text-2xl font-bold">Эрхэм Консалтинг</span>
            </div>
            <p className="text-gray-400 mb-6">
              Импортын автомашины үнийн мэдээлэл. Үнэ тооцоолж, ижил заруудыг харьцуулж, шийдвэрээ итгэлтэй гаргаарай.
            </p>
            <div className="flex space-x-4">
              <a
                href="https://www.facebook.com/telmuun.narankhuu.1"
                className="bg-gray-800 p-2 rounded-full hover:bg-blue-700 transition-colors"
              >
                <Facebook className="h-5 w-5" />
              </a>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-4">Товч холбоос</h3>
            <ul className="space-y-3">
              <li><a href="#home" className="text-gray-400 hover:text-blue-300 transition-colors">Нүүр</a></li>
              <li><a href="#report" className="text-gray-400 hover:text-blue-300 transition-colors">Тайлан</a></li>
              <li><a href="#listings" className="text-gray-400 hover:text-blue-300 transition-colors">Зарууд</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-4">Холбоо барих</h3>
            <ul className="space-y-3">
              <li><a href="#home" className="text-gray-400 hover:text-blue-300 transition-colors">Үнэ тооцоолох</a></li>
              <li><a href="#report" className="text-gray-400 hover:text-blue-300 transition-colors">Зах зээлийн тойм</a></li>
              <li><a href="#listings" className="text-gray-400 hover:text-blue-300 transition-colors">Ижил зарууд</a></li>
            </ul>
          </div>
        </div>
        
        <hr className="border-gray-800 mb-8" />
        
        <div className="flex flex-col md:flex-row justify-between items-center text-gray-500 text-sm">
          <div className="mb-4 md:mb-0">
            © 2026 Эрхэм Авто Инсайтс. Бүх эрх хуулиар хамгаалагдсан.
          </div>
          <div className="flex space-x-6">
            <a href="#home" className="hover:text-blue-300 transition-colors">Дээд хэсэг рүү</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
