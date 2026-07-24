/**
 * LAYOUT STRUCTURE - LMS Multi-Tenant SaaS
 * 
 * This document outlines the reusable layouts used throughout the LMS application.
 */

/**
 * LandingLayout
 * ============
 * Used for: Public landing page
 * Structure:
 *   - Header (Navigation, Logo, Links)
 *   - Main Content Area (Outlet)
 *   - Footer (Links, Copyright, Social)
 * 
 * Route: /
 */

/**
 * AuthLayout
 * ========
 * Used for: Login and registration pages
 * Structure:
 *   - Centered container (max-w-md)
 *   - Main Content Area (Outlet) - Auth forms
 * 
 * Routes:
 *   - /login
 *   - /register
 *   - /auth/login
 *   - /auth/register
 */

/**
 * DashboardLayout
 * ==============
 * Used for: Authenticated user dashboards (all roles)
 * 
 * Structure:
 *   - TopNavigation (Header)
 *     - Sidebar toggle (Desktop)
 *     - Mobile menu toggle (Mobile)
 *     - Notifications
 *     - User menu dropdown
 *   
 *   - Sidebar (Desktop only)
 *     - Collapsible navigation
 *     - Expandable submenu items
 *     - Icons from Lucide React
 *     - Smooth transitions
 *   
 *   - MobileNavigation (Mobile only)
 *     - Overlay menu
 *     - Expandable submenu
 *     - Close on navigation
 *     - Animation: slideIn (0.3s)
 *   
 *   - Main Content Area (Outlet)
 *     - Responsive padding (p-4 md:p-6 lg:p-8)
 *     - Scrollable
 *   
 *   - Footer (Responsive)
 *
 * Routes:
 *   - /student
 *   - /teacher
 *   - /parent
 *   - /staff
 *   - /admin
 *   - /principal
 *   - /dashboard/* (nested routes)
 * 
 * Features:
 *   ✓ Responsive design (mobile-first)
 *   ✓ Collapsible sidebar (desktop)
 *   ✓ Mobile overlay menu
 *   ✓ Dropdown user menu
 *   ✓ Notification badge
 *   ✓ Smooth animations
 *   ✓ Tailwind CSS utility classes
 *   ✓ Lucide React icons
 */

/**
 * COMMON COMPONENTS
 * ================
 * 
 * Header
 *   - Logo and branding
 *   - Navigation links (responsive)
 *   - Mobile menu toggle
 * 
 * Footer
 *   - Multi-column layout (responsive)
 *   - Product, Company, Legal sections
 *   - Social media links
 *   - Copyright notice
 */

/**
 * DASHBOARD COMPONENTS
 * ===================
 * 
 * TopNavigation
 *   - Sidebar toggle button
 *   - Mobile menu toggle button
 *   - Notifications with badge
 *   - User menu with dropdown
 *   - Sticky positioning
 * 
 * Sidebar
 *   - Collapsible with smooth transition
 *   - Expandable menu items
 *   - Icons for each menu item
 *   - Submenu support
 *   - Hover states
 *   - Desktop only (hidden on mobile)
 * 
 * MobileNavigation
 *   - Full-screen overlay
 *   - Slide-in animation
 *   - Close button
 *   - Expandable menu items
 *   - Closes on navigation
 *   - Mobile only (hidden on desktop)
 */

/**
 * TAILWIND CONFIGURATION
 * ====================
 * - Content paths configured
 * - Custom animations (slideIn)
 * - Responsive breakpoints: sm, md, lg
 */

/**
 * KEY FEATURES
 * ===========
 * 1. Modern React Architecture
 *    - Functional components with hooks
 *    - useState for state management
 *    - Outlet for nested routing
 *    - Link for client-side navigation
 * 
 * 2. Responsive Design
 *    - Mobile-first approach
 *    - Breakpoints: sm (640px), md (768px), lg (1024px)
 *    - Conditional rendering for mobile/desktop
 *    - Flexible containers
 * 
 * 3. Accessibility
 *    - Semantic HTML
 *    - aria-labels on buttons
 *    - Keyboard navigation support
 * 
 * 4. Performance
 *    - Modular component structure
 *    - Lazy loading ready
 *    - Lightweight Lucide React icons
 *    - CSS-in-JS via Tailwind
 * 
 * 5. User Experience
 *    - Smooth animations and transitions
 *    - Visual feedback (hover states)
 *    - Responsive navigation
 *    - Clear visual hierarchy
 */
