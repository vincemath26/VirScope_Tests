import { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Landing from './pages/Landing';
import Register from './pages/Register';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Visualisation from './pages/Visualisation';
import Authenticated from './components/Authenticated';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  // Remove default body margins
  useEffect(() => {
    document.documentElement.style.margin = 0;
    document.body.style.margin = 0;
  }, []);

  return (
    <Router>
      {/* ToastContainer added here for global access */}
      <ToastContainer
        position="top-right"
        autoClose={3000}        // 3 seconds
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnHover
        draggable
        theme="light"
      />
      <AppHeaders />
    </Router>
  );
}

function AppHeaders() {
  const location = useLocation();
  const exceptionHeader = ['/', '/register', '/login'];
  const showHeader = !exceptionHeader.includes(location.pathname);

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
        <Route path='/visualise/:uploadId' element={<Visualisation />} />
      </Routes>
    </>
  );
}

export default App;
