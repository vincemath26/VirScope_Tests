import { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Landing from './pages/Landing';
import Register from './pages/Register';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Authenticated from './components/Authenticated'

function App() {
  // Get rid of the borders
  useEffect(() => {
    document.documentElement.style.margin = 0;
    document.body.style.margin = 0;
  }, []);

  return (
    <Router>
      <AppHeaders />
    </Router>
  )
}

function AppHeaders() {
  const location = useLocation();
  const exceptionHeader = ['/', '/register', '/login']
  const showHeader = !exceptionHeader.includes(location.pathname);

  // As recommended by the live lecture, App.jsx should just
  // be for global states and routes.
  return (
    <>
      {showHeader && <Header />}
      <Routes>
        <Route path='/' element={<Landing />} />
        <Route path='/register' element={<Register />} />
        <Route path='/login' element={<Login />} />
        <Route element={<Authenticated />}>
          <Route path='/dashboard' element={<Dashboard />} />
        </Route>
      </Routes>
    </>
  )
}

export default App
