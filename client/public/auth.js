// Authentication JavaScript handler
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Initialize Supabase client
const supabaseUrl = 'https://qjcxdydxytfnsaasenoa.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqY3hkeWR4eXRmbnNhYXNlbm9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyMTIyMDUsImV4cCI6MjA2OTc4ODIwNX0.XcxDiVoKNkKjXLkoPb0gtPe0R9yhJC6wFD9KeCAMJLU';
const supabase = createClient(supabaseUrl, supabaseKey);

// Global utilities
class AuthManager {
  constructor() {
    this.maxAttempts = 3;
    this.lockoutDuration = 10 * 60 * 1000; // 10 minutes in milliseconds
  }

  // Login attempt tracking
  getLoginAttempts() {
    const data = localStorage.getItem('loginAttempts');
    if (!data) return { count: 0, lastAttempt: null };
    return JSON.parse(data);
  }

  incrementLoginAttempts() {
    const attempts = this.getLoginAttempts();
    attempts.count += 1;
    attempts.lastAttempt = Date.now();
    localStorage.setItem('loginAttempts', JSON.stringify(attempts));
    return attempts;
  }

  resetLoginAttempts() {
    localStorage.removeItem('loginAttempts');
  }

  isLockedOut() {
    const attempts = this.getLoginAttempts();
    if (attempts.count >= this.maxAttempts) {
      const timeSinceLastAttempt = Date.now() - attempts.lastAttempt;
      return timeSinceLastAttempt < this.lockoutDuration;
    }
    return false;
  }

  getLockoutTimeRemaining() {
    const attempts = this.getLoginAttempts();
    const timeSinceLastAttempt = Date.now() - attempts.lastAttempt;
    return Math.max(0, this.lockoutDuration - timeSinceLastAttempt);
  }

  // UI utilities
  showError(elementId, message) {
    const errorEl = document.getElementById(elementId);
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  }

  hideError(elementId) {
    document.getElementById(elementId).classList.add('hidden');
  }

  showSuccess(elementId, message) {
    const successEl = document.getElementById(elementId);
    successEl.textContent = message;
    successEl.classList.remove('hidden');
  }

  setLoading(buttonId, isLoading) {
    const button = document.getElementById(buttonId);
    if (isLoading) {
      button.disabled = true;
      button.innerHTML = '<span class="loading-spinner"></span>Processing...';
    } else {
      button.disabled = false;
      button.innerHTML = button.dataset.originalText || 'Submit';
    }
  }

  normalizeError(err) {
    // Network errors show as generic TypeError("Failed to fetch") in browsers
    if (err && (err.name === 'TypeError' || err.message === 'Failed to fetch')) {
      return 'Network error contacting Supabase. Check internet, CORS/Site URL settings, or try again.';
    }
    if (typeof err === 'string') return err;
    if (err && err.message) return err.message;
    return 'Unexpected error. Please try again.';
  }
}

const authManager = new AuthManager();

async function supabaseHealthCheck() {
  try {
    // Some projects require an apikey header even for /auth/v1/health
    const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
      cache: 'no-store',
      headers: { apikey: supabaseKey },
    });
    return res.ok;
  } catch (_) {
    return false;
  }
}

// Login page functionality
if (document.getElementById('loginForm')) {
  const loginForm = document.getElementById('loginForm');
  const signInBtn = document.getElementById('signInBtn');
  const forgotLink = document.getElementById('forgotLink');
  
  // Store original button text
  signInBtn.dataset.originalText = signInBtn.textContent;

  // Check if user is locked out on page load
  if (authManager.isLockedOut()) {
    startLockoutCountdown();
  } else {
    // Show forgot password link if there have been previous failed attempts
    const attempts = authManager.getLoginAttempts();
    if (attempts.count > 0) {
      forgotLink.classList.remove('hidden');
    }
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (authManager.isLockedOut()) {
      authManager.showError('loginError', 'Account temporarily locked. Please wait.');
      return;
    }

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    authManager.hideError('loginError');
    authManager.setLoading('signInBtn', true);

    try {
      // Basic connectivity check to surface clearer errors
      const ok = await supabaseHealthCheck();
      // If health check fails, continue anyway; supabase-js may still work.
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) {
        throw error;
      }

      // Success - reset attempts and show success overlay
      authManager.resetLoginAttempts();
      authManager.hideError('loginError');

      const showSuccessOverlay = () => {
        const overlay = document.getElementById('successOverlay');
        if (overlay) {
          const text = overlay.querySelector('.success-text');
          if (text) text.textContent = 'Signed in successfully';
          overlay.classList.remove('hidden');
        }
      };

      showSuccessOverlay();

      // Store user session info
      localStorage.setItem('userSession', JSON.stringify(data.session));
      
      // Redirect to app entry (React SPA root) after brief success animation
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);

    } catch (error) {
      // Special-case unconfirmed email: resend confirmation instead of counting as a failed attempt
      if (error && (error.code === 'email_not_confirmed' || /email not confirmed/i.test(error.message))) {
        try {
          await supabase.auth.resend({ type: 'signup', email });
          authManager.showError('loginError', 'Email not confirmed. We resent the confirmation link to your inbox.');
        } catch (_) {
          authManager.showError('loginError', 'Email not confirmed. Please check your inbox for the confirmation link.');
        }
      } else {
        const attempts = authManager.incrementLoginAttempts();
        
        if (attempts.count >= authManager.maxAttempts) {
          authManager.showError('loginError', 'Too many failed attempts. Account locked for 10 minutes.');
          startLockoutCountdown();
        } else {
          const msg = authManager.normalizeError(error) || 'Invalid credentials.';
          authManager.showError('loginError', `${msg} ${authManager.maxAttempts - attempts.count} attempts remaining.`);
          
          // Show forgot password link after first failed attempt
          if (attempts.count >= 1) {
            forgotLink.classList.remove('hidden');
          }
        }
      }
    } finally {
      authManager.setLoading('signInBtn', false);
    }
  });

  function startLockoutCountdown() {
    signInBtn.disabled = true;
    
    const updateCountdown = () => {
      const timeRemaining = authManager.getLockoutTimeRemaining();
      
      if (timeRemaining <= 0) {
        signInBtn.disabled = false;
        authManager.hideError('loginError');
        forgotLink.classList.remove('hidden');
        return;
      }
      
      const minutes = Math.floor(timeRemaining / 60000);
      const seconds = Math.floor((timeRemaining % 60000) / 1000);
      
      authManager.showError('loginError', 
        `Account locked. Try again in <span class="countdown-timer">${minutes}:${seconds.toString().padStart(2, '0')}</span>`
      );
      
      setTimeout(updateCountdown, 1000);
    };
    
    updateCountdown();
  }
}

// Registration page functionality (details -> password, no OTP)
if (document.getElementById('detailsForm')) {
  const detailsForm = document.getElementById('detailsForm');
  const continueBtn = document.getElementById('continueBtn');

  continueBtn.dataset.originalText = continueBtn.textContent;

  detailsForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const email = document.getElementById('email').value.trim();

    authManager.hideError('registerError');
    authManager.setLoading('continueBtn', true);

    try {
      // Persist details for the password step
      sessionStorage.setItem('registrationFirstName', firstName);
      sessionStorage.setItem('registrationLastName', lastName);
      sessionStorage.setItem('registrationEmail', email);

      // Navigate to password page
      window.location.href = 'set-password.html';
    } catch (error) {
      authManager.showError('registerError', authManager.normalizeError(error));
    } finally {
      authManager.setLoading('continueBtn', false);
    }
  });
}

// Set password page functionality
if (document.getElementById('passwordForm')) {
  const passwordForm = document.getElementById('passwordForm');
  const setPasswordBtn = document.getElementById('setPasswordBtn');
  
  setPasswordBtn.dataset.originalText = setPasswordBtn.textContent;

  passwordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    authManager.hideError('passwordError');
    
    // Validate passwords match
    if (password !== confirmPassword) {
      authManager.showError('passwordError', 'Passwords do not match.');
      return;
    }
    
    // Validate password strength
    if (password.length < 6) {
      authManager.showError('passwordError', 'Password must be at least 6 characters long.');
      return;
    }

    authManager.setLoading('setPasswordBtn', true);

    try {
      const ok = await supabaseHealthCheck();
      // Proceed regardless; health check can be restricted on some projects.
      // Gather details from the previous step
      const email = sessionStorage.getItem('registrationEmail');
      const firstName = sessionStorage.getItem('registrationFirstName') || '';
      const lastName = sessionStorage.getItem('registrationLastName') || '';

      if (!email) {
        throw new Error('Registration email missing. Please start again.');
      }

      // Create user in Supabase with profile metadata
      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          emailRedirectTo: window.location.origin + '/auth.html',
          data: {
            first_name: firstName,
            last_name: lastName
          }
        }
      });

      if (error) {
        throw error;
      }

      // Optional: insert profile row if a `profiles` table exists (ignore if missing)
      try {
        if (data && data.user) {
          const profile = {
            id: data.user.id,
            email,
            first_name: firstName,
            last_name: lastName,
            created_at: new Date().toISOString(),
          };
          const { error: profileError } = await supabase
            .from('profiles')
            .insert([profile]);
          if (profileError && profileError.code !== '42P01') {
            // Table exists but insert failed → log for debugging
            console.warn('Profile insert error:', profileError);
          }
        }
      } catch (e) {
        // Silently ignore if table doesn't exist or insert isn't configured
        console.warn('Skipping profile insert:', e);
      }

      // Success UI and cleanup
      authManager.showSuccess('passwordError', 'New user created! Redirecting to login...');

      sessionStorage.removeItem('registrationEmail');
      sessionStorage.removeItem('registrationFirstName');
      sessionStorage.removeItem('registrationLastName');

      setTimeout(() => {
        window.location.href = 'auth.html';
      }, 1500);

    } catch (error) {
      authManager.showError('passwordError', authManager.normalizeError(error));
    } finally {
      authManager.setLoading('setPasswordBtn', false);
    }
  });
}

// If already signed in, optionally redirect to app root
(async () => {
  try {
    const { data } = await supabase.auth.getSession();
    if (data && data.session) {
      // Only auto-redirect on auth and register pages; not on password page
      const path = window.location.pathname;
      if (path.endsWith('auth.html') || path.endsWith('register.html')) {
        window.location.replace('/');
      }
    }
  } catch (_) {
    // ignore
  }
})();

// Export for global access
window.authManager = authManager;
window.supabase = supabase;
