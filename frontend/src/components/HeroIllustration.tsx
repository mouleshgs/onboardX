import React from 'react';
import { FileText, Users, Shield, CheckCircle } from 'lucide-react';

const HeroIllustration: React.FC = () => {
  return (
    <div className="relative w-full h-96 flex items-center justify-center">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-100/50 to-teal-100/50 rounded-3xl"></div>
      
      {/* Main Illustration */}
      <div className="relative z-10 w-full max-w-md">
        {/* Vendor Side */}
        <div className="absolute left-4 top-8 bg-white rounded-lg shadow-lg p-4 transform -rotate-2 hover:rotate-0 transition-transform duration-300">
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <FileText className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-900">Vendor Portal</span>
          </div>
          <div className="space-y-2">
            <div className="h-2 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-2 bg-blue-200 rounded w-3/4"></div>
            <div className="flex items-center space-x-1">
              <div className="w-6 h-6 bg-blue-600 rounded text-white flex items-center justify-center text-xs font-bold">
                +
              </div>
              <span className="text-xs text-gray-600">Upload PDF</span>
            </div>
          </div>
        </div>

        {/* Transfer Arrow */}
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
          <div className="w-16 h-16 bg-white rounded-full shadow-lg border-4 border-blue-200 flex items-center justify-center animate-pulse">
            <Shield className="w-6 h-6 text-blue-600" />
          </div>
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-teal-500 rounded-full flex items-center justify-center">
            <CheckCircle className="w-4 h-4 text-white" />
          </div>
        </div>

        {/* Distributor Side */}
        <div className="absolute right-4 bottom-8 bg-white rounded-lg shadow-lg p-4 transform rotate-2 hover:rotate-0 transition-transform duration-300">
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center">
              <Users className="w-4 h-4 text-teal-600" />
            </div>
            <span className="text-sm font-medium text-gray-900">Distributor View</span>
          </div>
          <div className="space-y-2">
            <div className="h-2 bg-gray-200 rounded"></div>
            <div className="h-2 bg-teal-200 rounded w-2/3"></div>
            <div className="flex items-center space-x-1">
              <div className="w-6 h-6 bg-teal-600 rounded text-white flex items-center justify-center text-xs">
                ✓
              </div>
              <span className="text-xs text-gray-600">Sign & Access</span>
            </div>
          </div>
        </div>

        {/* Floating Elements */}
        <div className="absolute top-4 right-12 w-8 h-8 bg-blue-200 rounded-full animate-bounce delay-100"></div>
        <div className="absolute bottom-4 left-12 w-6 h-6 bg-teal-200 rounded-full animate-bounce delay-300"></div>
        
        {/* Signature Path */}
        <div className="absolute inset-0 pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 300 200">
            <path
              d="M 50 100 Q 150 50 250 100"
              stroke="#0F62FE"
              strokeWidth="2"
              strokeDasharray="5,5"
              fill="none"
              className="animate-pulse opacity-60"
            />
          </svg>
        </div>
      </div>
    </div>
  );
};

export default HeroIllustration;