# OnboardX Frontend

A modern React + TypeScript SPA for contract signing and onboarding management.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- OnboardX backend server running on `http://localhost:3000`

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will be available at `http://localhost:5173` with automatic proxy to the backend API.

### Build for Production

```bash
# Build the application
npm run build

# Preview the build
npm run preview
```

## 🏗️ Architecture

### Tech Stack
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Routing**: React Router v6
- **State Management**: TanStack Query (React Query)
- **Styling**: Tailwind CSS + Tailwind Forms
- **Animations**: Framer Motion
- **HTTP Client**: Axios
- **Authentication**: Firebase Auth + Firestore
- **Testing**: Vitest + Testing Library
- **Linting**: ESLint + Prettier

### Project Structure

```
src/
├── api/                 # API client and HTTP utilities
├── components/          # Reusable UI components
│   ├── contracts/       # Contract-specific components
│   ├── layout/          # Layout components (TopNav, etc.)
│   ├── modals/          # Modal components
│   └── ui/              # Generic UI components
├── contexts/            # React contexts (Auth, etc.)
├── hooks/               # Custom React hooks
├── pages/               # Page components
├── styles/              # Global styles and CSS
├── test/                # Test utilities and setup
├── types/               # TypeScript type definitions
└── config/              # Configuration files
```

## 🔧 Configuration

### Environment Variables

The frontend uses Vite's proxy configuration to forward API calls to the backend. No additional environment variables are required for basic functionality.

### Vite Proxy Configuration

```typescript
// vite.config.ts
server: {
  proxy: {
    '/api': 'http://localhost:3000',
    '/contract': 'http://localhost:3000',
    '/signed': 'http://localhost:3000',
  },
}
```

## 🎨 UI/UX Features

### Design System
- **Colors**: Primary blue palette with accent teal
- **Typography**: Inter font family with consistent sizing
- **Spacing**: 8px grid system
- **Components**: Consistent button styles, form inputs, cards
- **Animations**: Smooth transitions and micro-interactions

### Accessibility
- Semantic HTML structure
- ARIA attributes for modals and interactive elements
- Keyboard navigation support
- Focus management
- Screen reader friendly

### Responsive Design
- Mobile-first approach
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- Flexible grid layouts
- Touch-friendly interface elements

## 🧪 Testing

### Running Tests

```bash
# Run tests
npm run test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

### Test Structure
- **Unit Tests**: Component logic and API client
- **Integration Tests**: User workflows and interactions
- **Mocking**: Firebase, API calls, and external dependencies

### Example Test Files
- `SignaturePad.test.tsx` - Canvas signature functionality
- `ApiClient.test.ts` - HTTP client and error handling

## 📱 Pages & Features

### Login Page (`/login`)
- Email/password authentication
- Google Sign-in integration
- Role selection (Vendor/Distributor)
- Responsive design with visual branding

### Vendor Dashboard (`/vendor`)
- Contract upload form (PDF files)
- Contract list with status tracking
- Onboarding progress indicators
- Nudge functionality for distributors

### Distributor Dashboard (`/` or `/distributor`)
- Assigned contracts list with search
- PDF viewer with signature pad
- Contract signing workflow
- Access tools modal after signing
- Notifications system

### Analytics Dashboard (`/dashboard`)
- Contract statistics and metrics
- Per-vendor performance charts
- Progress visualization with animated charts
- Searchable contract table
- Recent completions timeline

## 🔐 Authentication Flow

1. **Login**: User signs in with email/password or Google
2. **Role Resolution**: Check Firestore for authoritative role
3. **Token Management**: Store Firebase ID token locally
4. **API Integration**: Inject token in API requests
5. **Route Protection**: Redirect based on user role and auth status

## 🌐 API Integration

### Endpoints Used
- `POST /api/vendor/upload` - Upload contracts
- `GET /api/contracts` - List all contracts
- `GET /api/vendor/contracts` - Vendor-specific contracts
- `GET /api/contract/:id/pdf` - Stream PDF content
- `POST /api/sign` - Submit signature
- `GET /api/contract/:id/access` - Access tools and progress
- `POST /api/contract/:id/nudge` - Send nudges
- `GET /api/notifications` - List notifications
- `POST /api/notifications/mark-read` - Mark as read

### Error Handling
- Centralized error handling in API client
- User-friendly error messages
- Toast notifications for feedback
- Retry logic for failed requests

## 🎯 Performance Optimizations

### Code Splitting
- Route-based code splitting
- Lazy loading of heavy components
- Dynamic imports for optional features

### Caching Strategy
- TanStack Query for server state caching
- Stale-while-revalidate pattern
- Optimistic updates for better UX

### Bundle Optimization
- Tree shaking for unused code
- Vite's built-in optimizations
- Tailwind CSS purging

## 🚀 Deployment

### Build Process
```bash
npm run build
```

### Static Hosting
The built application (`dist/` folder) can be deployed to any static hosting service:
- Vercel
- Netlify
- AWS S3 + CloudFront
- GitHub Pages

### Backend Integration
Ensure the backend server is accessible from your deployment environment and update the proxy configuration if needed.

## 🔍 Development Tools

### Code Quality
```bash
# Linting
npm run lint

# Formatting (via Prettier)
npx prettier --write src/
```

### VS Code Extensions (Recommended)
- ES7+ React/Redux/React-Native snippets
- Tailwind CSS IntelliSense
- TypeScript Importer
- Prettier - Code formatter
- ESLint

## 🐛 Troubleshooting

### Common Issues

1. **API calls failing**: Ensure backend server is running on port 3000
2. **Firebase auth errors**: Check Firebase configuration in `src/config/firebase.ts`
3. **Build errors**: Clear node_modules and reinstall dependencies
4. **Styling issues**: Ensure Tailwind CSS is properly configured

### Debug Mode
Set `NODE_ENV=development` for additional logging and error details.

## 📋 Migration Checklist

To integrate this frontend with the existing OnboardX project:

1. ✅ **Backend Compatibility**: All existing API endpoints are used without modification
2. ✅ **Authentication**: Firebase configuration matches existing setup
3. ✅ **File Structure**: Frontend is completely isolated in `frontend/` directory
4. ✅ **Build Process**: Independent build system with Vite
5. ✅ **Deployment**: Can be deployed separately from backend
6. ✅ **Testing**: Comprehensive test suite included

### Integration Steps
1. Copy the `frontend/` directory to your project root
2. Install dependencies: `cd frontend && npm install`
3. Start development: `npm run dev`
4. Build for production: `npm run build`
5. Deploy the `dist/` folder to your hosting service

## 🤝 Contributing

1. Follow the existing code style and patterns
2. Add tests for new features
3. Update documentation as needed
4. Use conventional commit messages
5. Ensure all tests pass before submitting

## 📄 License

This project is part of the OnboardX system and follows the same licensing terms.