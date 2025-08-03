// Authentication JavaScript handler
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Initialize Supabase client
const supabaseUrl = 'https://qjcxdydxytfnsaaesenoa.supabase.co';
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
}

const authManager = new AuthManager();

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
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) {
        throw error;
      }

      // Success - reset attempts and redirect
      authManager.resetLoginAttempts();
      authManager.showSuccess('loginError', 'Login successful! Redirecting to dashboard...');
      
      // Store user session info
      localStorage.setItem('userSession', JSON.stringify(data.session));
      
      // Redirect to dashboard (replace with your dashboard URL)
      setTimeout(() => {
        window.location.href = '/dashboard.html'; // Update this path as needed
      }, 1500);

    } catch (error) {
      const attempts = authManager.incrementLoginAttempts();
      
      if (attempts.count >= authManager.maxAttempts) {
        authManager.showError('loginError', 'Too many failed attempts. Account locked for 10 minutes.');
        startLockoutCountdown();
      } else {
        authManager.showError('loginError', `Invalid credentials. ${authManager.maxAttempts - attempts.count} attempts remaining.`);
        
        // Show forgot password link after first failed attempt
        if (attempts.count >= 1) {
          forgotLink.classList.remove('hidden');
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

// Registration page functionality
if (document.getElementById('registerForm')) {
  const registerForm = document.getElementById('registerForm');
  const requestOtpBtn = document.getElementById('requestOtpBtn');
  const verifyOtpBtn = document.getElementById('verifyOtpBtn');
  const otpSection = document.getElementById('otpSection');
  
  requestOtpBtn.dataset.originalText = requestOtpBtn.textContent;
  verifyOtpBtn.dataset.originalText = verifyOtpBtn.textContent;

  // Request OTP
  document.getElementById('emailForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    
    authManager.hideError('registerError');
    authManager.setLoading('requestOtpBtn', true);

    try {
      const { error } = await supabase.auth.signUp({
        email: email,
        password: 'temporary-password', // Will be updated in set-password page
        options: {
          emailRedirectTo: window.location.origin + '/set-password.html'
        }
      });

      if (error) {
        throw error;
      }

      // Store email for later use
      sessionStorage.setItem('registrationEmail', email);
      
      // Show OTP section
      otpSection.classList.remove('hidden');
      authManager.showSuccess('registerError', 'OTP sent to your email. Please check your inbox.');
      
    } catch (error) {
      authManager.showError('registerError', error.message);
    } finally {
      authManager.setLoading('requestOtpBtn', false);
    }
  });

  // Verify OTP
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = sessionStorage.getItem('registrationEmail');
    const otp = document.getElementById('otp').value;
    
    authManager.hideError('registerError');
    authManager.setLoading('verifyOtpBtn', true);

    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email,
        token: otp,
        type: 'signup'
      });

      if (error) {
        throw error;
      }

      authManager.showSuccess('registerError', 'Email verified! Redirecting to password setup...');
      
      setTimeout(() => {
        window.location.href = 'set-password.html';
      }, 1500);

    } catch (error) {
      authManager.showError('registerError', error.message);
    } finally {
      authManager.setLoading('verifyOtpBtn', false);
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
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        throw error;
      }

      authManager.showSuccess('passwordError', 'Password set successfully! Redirecting to login...');
      
      // Clear registration email from session
      sessionStorage.removeItem('registrationEmail');
      
      setTimeout(() => {
        window.location.href = 'auth.html';
      }, 1500);

    } catch (error) {
      authManager.showError('passwordError', error.message);
    } finally {
      authManager.setLoading('setPasswordBtn', false);
    }
  });
}

// Export for global access
window.authManager = authManager;
window.supabase = supabase;