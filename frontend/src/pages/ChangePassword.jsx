import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

function ChangePassword() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login, logout, user } = useAuth();
  const navigate = useNavigate();
  const isFormValid = newPassword.length >= 6 && newPassword === confirmPassword;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);

    try {
      const response = await api.post('/auth/change-password', { newPassword });
      login(response.data.token);
      setSuccess('Password updated successfully. Redirecting to your dashboard...');
      window.setTimeout(() => {
        navigate('/');
      }, 900);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to change password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-hero">
        <div className="auth-hero__content">
          <p className="eyebrow">Secure Onboarding</p>
          <h1>Set your new password before entering the workspace.</h1>
          <p className="auth-hero__copy">
            {user?.name || 'Your account'} was created with a temporary password. For security, choose a new password to continue.
          </p>
        </div>
      </div>

      <div className="auth-panel">
        <form className="auth-card" onSubmit={handleSubmit}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">First Login</p>
              <h2>Change your password</h2>
            </div>
          </div>

          <label>
            <span>New password</span>
            <input
              className="input-field"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          </label>

          <label>
            <span>Confirm password</span>
            <input
              className="input-field"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </label>

          {error && <div className="alert-banner alert-banner--error">{error}</div>}
          {success && <div className="alert-banner alert-banner--success">{success}</div>}

          <button className="btn btn-primary auth-submit" type="submit" disabled={submitting || !isFormValid}>
            {submitting ? 'Updating...' : 'Update Password'}
          </button>

          <button className="btn btn-secondary auth-submit" type="button" onClick={logout}>
            Logout
          </button>
        </form>
      </div>
    </div>
  );
}

export default ChangePassword;
