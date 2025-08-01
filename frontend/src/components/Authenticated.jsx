import { Navigate, Outlet } from 'react-router-dom';

const Authenticated = () => {
  const token = localStorage.getItem('token');

  if (!token) {
    return <Navigate to='/' replace/>;
  }

  return <Outlet />;
};

export default Authenticated;