import { QueryClientProvider } from '@tanstack/react-query'
import Routes from './routes/Routes'
import './App.css'
import CookieNotice from './components/privacy/CookieNotice'
import ErrorBoundary from './components/ErrorBoundary'
import { ToastProvider } from './context/ToastContext'
import { ConfirmProvider } from './components/ui/ConfirmDialog'
import { queryClient } from './services/queryClient'

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ConfirmProvider>
            <Routes />
            <CookieNotice />
          </ConfirmProvider>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App
