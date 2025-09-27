import React, { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, LogIn } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { LoadingSpinner } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import toast from 'react-hot-toast'

export const LoginPage: React.FC = () => {
  const { user, loading, signIn, signUp, signInWithGoogle } = useAuth()
  const [isSignUp, setIsSignUp] = useState(false)
  const [role, setRole] = useState<'distributor' | 'vendor'>('distributor')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (user) {
    return <Navigate to={user.role === 'vendor' ? '/vendor' : '/'} replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return

    setIsSubmitting(true)
    setError('')

    try {
      if (isSignUp) {
        await signUp(email, password, role)
        toast.success('Account created successfully!')
      } else {
        await signIn(email, password, role)
        toast.success('Signed in successfully!')
      }
    } catch (error: any) {
      setError(error.message || 'Authentication failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true)
    setError('')

    try {
      await signInWithGoogle(role)
      toast.success('Signed in with Google!')
    } catch (error: any) {
      setError(error.message || 'Google sign-in failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Visual */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 to-accent-500 items-center justify-center p-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center text-white"
        >
          <div className="w-24 h-24 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-8">
            <span className="text-4xl font-bold">OX</span>
          </div>
          <h1 className="text-4xl font-bold mb-4">OnboardX</h1>
          <p className="text-xl text-primary-100">
            Streamline contract signing and onboarding
          </p>
        </motion.div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900">
              {isSignUp ? 'Create Account' : 'Welcome Back'}
            </h2>
            <p className="text-gray-600 mt-2">
              {isSignUp ? 'Sign up to get started' : 'Sign in to your account'}
            </p>
          </div>

          {error && <ErrorBanner error={error} onDismiss={() => setError('')} />}

          {/* Role Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              I am a:
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="role"
                  value="distributor"
                  checked={role === 'distributor'}
                  onChange={(e) => setRole(e.target.value as 'distributor')}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Distributor</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="role"
                  value="vendor"
                  checked={role === 'vendor'}
                  onChange={(e) => setRole(e.target.value as 'vendor')}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Vendor</span>
              </label>
            </div>
          </div>

          {/* Google Sign In */}
          <button
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
            className="w-full btn-secondary mb-6 justify-center"
          >
            {isSubmitting ? (
              <LoadingSpinner className="mr-2" />
            ) : (
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            )}
            Continue with Google
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or</span>
            </div>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-10"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-10"
                  placeholder="Enter your password"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !email || !password}
              className="w-full btn-primary justify-center"
            >
              {isSubmitting ? (
                <LoadingSpinner className="mr-2" />
              ) : (
                <LogIn className="w-5 h-5 mr-2" />
              )}
              {isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              {isSignUp
                ? 'Already have an account? Sign in'
                : "Don't have an account? Sign up"}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}