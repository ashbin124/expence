import { getCurrentUser, signInWithEmail, signUpWithEmail } from "./cloud.js";
import { isSupabaseConfigured } from "./supabase.js";

const AUTH_FLASH_KEY = "expense-tracker-auth-flash";

const form = document.getElementById("authPageForm");
const emailInput = document.getElementById("authPageEmail");
const passwordInput = document.getElementById("authPagePassword");
const loginBtn = document.getElementById("authPageLoginBtn");
const signupBtn = document.getElementById("authPageSignupBtn");
const backBtn = document.getElementById("authPageBackBtn");
const noticeEl = document.getElementById("authPageNotice");
const errorEl = document.getElementById("authPageError");

function showNotice(message) {
  noticeEl.textContent = message;
}

function clearNotice() {
  showNotice("");
}

function showError(message) {
  errorEl.textContent = message;
}

function clearError() {
  showError("");
}

function setFlashMessage(message) {
  localStorage.setItem(AUTH_FLASH_KEY, message);
}

function goToMainPage(delayMs = 1200) {
  window.setTimeout(() => {
    window.location.href = "./index.html";
  }, delayMs);
}

function readErrorMessage(error, fallbackMessage) {
  if (error && typeof error === "object" && "message" in error) {
    const message = error.message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return fallbackMessage;
}

function toFriendlyAuthErrorMessage(error, fallbackMessage) {
  const raw = readErrorMessage(error, fallbackMessage);
  const normalized = raw.toLowerCase();

  if (normalized.includes("email not confirmed")) {
    return "Email not verified yet. Check inbox, verify email, then log in.";
  }

  if (normalized.includes("invalid login credentials")) {
    return "Invalid email or password.";
  }

  if (normalized.includes("user already registered")) {
    return "Account already exists. Try Log In.";
  }

  if (normalized.includes("signup is disabled")) {
    return "Sign up is disabled in Supabase settings.";
  }

  return raw;
}

function setLoading(loading) {
  loginBtn.disabled = loading;
  signupBtn.disabled = loading;
  backBtn.disabled = loading;
  emailInput.disabled = loading;
  passwordInput.disabled = loading;
}

async function handleLogin() {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showError("Email and password are required.");
    return;
  }

  setLoading(true);
  clearError();
  clearNotice();

  try {
    const data = await signInWithEmail(email, password);
    if (!data.user) {
      showError("Login failed. Please try again.");
      return;
    }

    setFlashMessage("Login successful. Cloud sync is active.");
    showNotice("Login successful. Redirecting to main page...");
    goToMainPage();
  } catch (error) {
    showError(toFriendlyAuthErrorMessage(error, "Unable to log in right now."));
  } finally {
    setLoading(false);
  }
}

async function handleSignUp() {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showError("Email and password are required.");
    return;
  }

  if (password.length < 6) {
    showError("Password should be at least 6 characters.");
    return;
  }

  setLoading(true);
  clearError();
  clearNotice();

  try {
    const data = await signUpWithEmail(email, password);

    if (data.session && data.user) {
      setFlashMessage("Account created and logged in successfully.");
      showNotice("Sign up successful. Redirecting to main page...");
      goToMainPage();
      return;
    }

    showNotice("Sign up successful. Verify your email, then log in.");
  } catch (error) {
    showError(toFriendlyAuthErrorMessage(error, "Unable to sign up right now."));
  } finally {
    setLoading(false);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await handleLogin();
});

signupBtn.addEventListener("click", async () => {
  await handleSignUp();
});

backBtn.addEventListener("click", () => {
  window.location.href = "./index.html";
});

(async function initAuthPage() {
  if (!isSupabaseConfigured) {
    showError("Supabase is not configured. Open main page and check setup.");
    setLoading(true);
    return;
  }

  setLoading(true);

  try {
    const user = await getCurrentUser();
    if (user) {
      setFlashMessage(`Already logged in as ${user.email ?? "user"}.`);
      showNotice("Already logged in. Redirecting to main page...");
      goToMainPage(900);
      return;
    }

    clearError();
    clearNotice();
  } catch (error) {
    showError(toFriendlyAuthErrorMessage(error, "Unable to check session right now."));
  } finally {
    setLoading(false);
  }
})();
