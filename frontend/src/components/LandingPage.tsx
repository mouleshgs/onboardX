import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Shield, 
  Upload, 
  FileText, 
  Users, 
  BarChart3, 
  Key, 
  Cloud, 
  CheckCircle,
  ArrowRight,
  Play
} from 'lucide-react';
import Header from './Header';
import HeroIllustration from './HeroIllustration';

const LandingPage: React.FC = () => {
  const features = [
    {
      icon: <Upload className="w-8 h-8" />,
      title: "Upload",
      description: "Drag and drop PDFs, assign distributors, and track progress in real-time."
    },
    {
      icon: <FileText className="w-8 h-8" />,
      title: "Sign", 
      description: "In-browser signature pad with ECDSA P-256 cryptographic signing for audit compliance."
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "Onboard",
      description: "Auto-generate Slack invites, Notion checklists, and temporary credentials instantly."
    },
    {
      icon: <BarChart3 className="w-8 h-8" />,
      title: "Analytics",
      description: "Track signing completion rates, distributor engagement, and onboarding metrics."
    }
  ];

  const trustFeatures = [
    { icon: <Key className="w-6 h-6" />, text: "ECDSA P-256 Signing" },
    { icon: <Cloud className="w-6 h-6" />, text: "Dropbox Storage" },
    { icon: <Shield className="w-6 h-6" />, text: "Firestore Persistence" },
    { icon: <CheckCircle className="w-6 h-6" />, text: "HTTPS Secure" },
  ];

  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-teal-50 pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-12 lg:gap-8 pt-12 pb-20">
            <div className="sm:text-center md:max-w-2xl md:mx-auto lg:col-span-6 lg:text-left lg:max-w-none">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-gray-900 leading-tight">
                Secure PDF signing & onboarding for 
                <span className="text-blue-600"> vendors + distributors</span>
              </h1>
              <p className="mt-6 text-xl text-gray-600 leading-relaxed">
                Upload contracts, request signatures in-browser, cryptographically sign PDFs, and automatically provision onboarding tools — fast, auditable, and secure.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 sm:justify-center lg:justify-start">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
                >
                  Get Started — Free
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
                <button className="inline-flex items-center justify-center px-8 py-4 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-lg border-2 border-gray-200 hover:border-gray-300 transition-all duration-200">
                  <Play className="mr-2 w-5 h-5" />
                  View Demo
                </button>
              </div>
            </div>
            <div className="mt-12 lg:mt-0 lg:col-span-6">
              <div className="mx-auto max-w-lg lg:max-w-none">
                <HeroIllustration />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-4">
              Complete signing workflow
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              From upload to onboarding, streamline your entire distributor relationship process
            </p>
          </div>
          
          <div className="mt-16 grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="bg-white p-8 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 group hover:border-blue-200">
                <div className="text-blue-600 group-hover:text-teal-600 transition-colors duration-300">
                  {feature.icon}
                </div>
                <h3 className="mt-4 text-xl font-semibold text-gray-900">{feature.title}</h3>
                <p className="mt-2 text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Row */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              Built for security and compliance
            </h2>
            <p className="text-gray-600">Enterprise-grade cryptography and infrastructure</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {trustFeatures.map((feature, index) => (
              <div key={index} className="flex flex-col items-center text-center group">
                <div className="p-4 bg-white rounded-full shadow-sm group-hover:shadow-md transition-all duration-300 border border-gray-100">
                  <div className="text-blue-600">
                    {feature.icon}
                  </div>
                </div>
                <p className="mt-3 text-sm font-medium text-gray-900">{feature.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-blue-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-semibold text-white mb-6">
            Ready to streamline your contract workflow?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join vendors and distributors who trust OnboardX for secure, auditable contract signing.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center justify-center px-8 py-4 bg-white hover:bg-gray-100 text-blue-600 font-semibold rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
          >
            Start Free Trial
            <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center">
                <Shield className="w-8 h-8 text-blue-400" />
                <span className="ml-2 text-xl font-semibold">OnboardX</span>
              </div>
              <p className="mt-4 text-gray-400 max-w-md">
                Secure contract signing and distributor onboarding platform with cryptographic signatures and automated provisioning.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link to="/docs" className="hover:text-white transition-colors">API Docs</Link></li>
                <li><a href="#" className="hover:text-white transition-colors">OpenAPI</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Security</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-gray-400">
            <p>&copy; 2025 OnboardX. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;