import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Home.css';

function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Frontend validation: check all fields
    if (!name || !email || !password || !confirm) {
      setError('All fields are required');
      setLoading(false);
      return;
    }

    // Frontend validation: email uniqueness check (basic format)
    if (!email.includes('@') || !email.includes('.')) {
      setError('Please enter a valid email address');
      setLoading(false);
      return;
    }

    // Frontend validation: password match
    if (password !== confirm) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    // Frontend validation: password strength (at least 6 chars)
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    // Call backend register (backend will validate email uniqueness and password match again)
    const result = await register(name.trim(), email.trim(), password, confirm);
    
    if (!result.success) {
      setError(result.error || 'Registration failed');
      setLoading(false);
      return;
    }

    setError(null);
    setLoading(false);

    // Redirect to home after successful registration
    navigate('/');
  };

  return (
    <div className="page-container">
      <h2>Register</h2>
      <form onSubmit={handleSubmit} className="auth-form">
        <label>
          Full Name
          <input 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            type="text" 
            placeholder="Your Name"
            required 
          />
        </label>
        <label>
          Email (Unique Username)
          <input 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            type="email" 
            placeholder="your@email.com"
            required 
          />
        </label>
        <label>
          Password
          <input 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            type="password" 
            placeholder="••••••••"
            required 
          />
        </label>
        <label>
          Confirm Password
          <input 
            value={confirm} 
            onChange={(e) => setConfirm(e.target.value)} 
            type="password" 
            placeholder="••••••••"
            required 
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Creating account...' : 'Register'}
        </button>
      </form>
      {error && <div className="error-text">{error}</div>}
      <p>
        Already have an account? <Link to="/login">Login here</Link>
      </p>
    </div>
  );
}

export default Register;
