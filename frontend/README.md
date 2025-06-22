# TCG Collection Manager

A modern web application for managing and organizing trading card game collections, built with Next.js and React.

## Features

### User Authentication & Security
- **Google OAuth Integration**: Seamless login with Google accounts
- **Secure Session Management**: Protected routes and API endpoints
- **Cookie Consent**: GDPR-compliant cookie management
- **User Profile Management**: Customizable profiles with avatar support

### Collection Management
- **Card Catalog**: Browse and search through your card collection
- **Card Details**: View comprehensive card information including:
  - Card images with zoom functionality
  - Card statistics and attributes
  - Market prices and value tracking
  - Condition tracking
- **Bulk Operations**: Import/export collections in various formats
- **Collection Statistics**: Track collection value and growth over time

### Binder Organization
- **Drag-and-Drop Interface**: Intuitive card organization
- **Custom Binder Layouts**: Create and manage multiple binder views
- **Card Sorting**: Sort by name, rarity, value, or custom criteria
- **Visual Organization**: Grid and list view options
- **Quick Search**: Find cards within your binders instantly

### User Interface
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Dark/Light Mode**: Choose your preferred theme
- **Smooth Animations**: Enhanced user experience with fluid transitions
- **Accessibility**: WCAG 2.1 compliant design
- **Loading States**: Skeleton screens and loading indicators

### Advanced Features
- **Card Market Integration**: Track card values and market trends
- **Collection Analytics**: Detailed insights into your collection
- **Wishlist Management**: Track cards you want to acquire
- **Trading Tools**: Manage trade offers and negotiations
- **Export Options**: Generate reports and share collection data

## Tech Stack

- **Frontend Framework**: Next.js 14
- **UI Library**: React 18
- **Styling**: Tailwind CSS
- **State Management**: Apollo Client
- **Authentication**: NextAuth.js
- **Form Handling**: React Hook Form
- **Drag and Drop**: DnD Kit
- **Image Handling**: React Zoom Pan Pinch
- **Deployment**: Netlify

## Project Structure

```
src/
├── app/            # Next.js app router pages and API routes
├── components/     # Reusable React components
│   ├── Auth/       # Authentication components
│   ├── Binder/     # Card binder view components
│   ├── Collection/ # Collection management components
│   ├── Cookies/    # Cookie consent components
│   ├── Layout/     # Layout components
│   ├── UI/         # Generic UI components
│   └── UserProfile/# User profile components
├── hooks/          # Custom React hooks
├── pages/          # Legacy pages (if any)
├── styles/         # Global styles
└── utils/          # Utility functions
```

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone [repository-url]
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Set up environment variables:
Create a `.env.local` file in the root directory with the following variables:
```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

4. Run the development server:
```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Deployment

This project is configured for deployment on Netlify. The deployment settings are defined in `netlify.toml`.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
