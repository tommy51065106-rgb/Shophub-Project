import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './ChangePassword.css';

function ChangePassword() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [csrfToken, setCsrfToken] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    async function getCsrf() {
      try {
        const res = await fetch('/api/csrf-token', { credentials: 'include' });
        if (!res.ok) throw new Error('Unable to fetch CSRF token');
        const data = await res.json();
        setCsrfToken(data.csrfToken || '');
      } catch (err) {
        console.error('CSRF fetch error', err);
        setError('Unable to initialize password change.');
      }
    }

    getCsrf();
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('');
    setError('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All fields are required.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to change password');
      }

      setStatus('Password changed successfully. Logging out...');
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err.message || 'Password change failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="change-password-page">
      <div className="change-password-card">
        <h2>Change Password</h2>
        <p>Please enter your current password and choose a new password.</p>

        {error && <div className="error-message">{error}</div>}
        {status && <div className="status-message">{status}</div>}

        <form onSubmit={handleSubmit}>
          <label>
            Current Password
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </label>

          <label>
            New Password
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </label>

          <label>
            Confirm New Password
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </label>

          <button type="submit" className="change-password-button" disabled={loading}>
            {loading ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ChangePassword;
