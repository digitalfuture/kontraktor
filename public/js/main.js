// Kontraktor Main Client-Side JavaScript
// Completely crash-proof, HTMX-compatible, and CSP-compliant.

// HTMX: Enable credentials (cookies) for AJAX requests
if (typeof htmx !== 'undefined') {
  htmx.config.withCredentials = true;
}

(() => {
  function init() {
    // 1. Mobile Sidebar Toggling via Event Delegation on Document
    // Uses translate-x-full/0 pattern like admin/account sidebars.
    // Completely immune to HTMX swaps and iOS click quirks.
    if (!window.mobileMenuInitialized) {
      window.mobileMenuInitialized = true;

      // Reset body cursor on initialization
      document.body.style.cursor = '';

      // Handle click/tap events for toggling, closing outside, or selecting links in the mobile sidebar.
      // A single, unified listener prevents touch/click race conditions and iOS double-trigger bugs.
      document.addEventListener('click', (e) => {
        const sidebar = document.getElementById('mobile-sidebar');
        const btn = document.getElementById('mobile-menu-btn');
        const adminAside = document.querySelector('aside[data-admin-sidebar]');

        const target = e.target;
        const path = e.composedPath ? e.composedPath() : [];
        const insideSidebar = sidebar && (path.includes(sidebar) || sidebar.contains(target));
        const insideBtn = btn && (path.includes(btn) || btn.contains(target));
        const insideAdminAside = adminAside && (path.includes(adminAside) || adminAside.contains(target));

        const hamburger = document.getElementById('hamburger-icon');
        const closeIcon = document.getElementById('close-icon');

        function updateIcons(open) {
          if (hamburger && closeIcon) {
            if (open) {
              hamburger.classList.add('hidden');
              closeIcon.classList.remove('hidden');
            } else {
              hamburger.classList.remove('hidden');
              closeIcon.classList.add('hidden');
            }
          }
        }

        var sidebarOpen = sidebar && !sidebar.classList.contains('-translate-x-full');

        // 1. Mobile Sidebar: Toggle button click
        if (insideBtn) {
          if (sidebar) {
            sidebar.classList.toggle('-translate-x-full');
            sidebar.classList.toggle('translate-x-0');
          }
          const isOpen = sidebar && !sidebar.classList.contains('-translate-x-full');
          btn.setAttribute('aria-expanded', String(isOpen));
          updateIcons(isOpen);
          // Fix iOS click bubbling quirk
          document.body.style.cursor = isOpen ? 'pointer' : '';
        }
        // 2. Mobile Sidebar: Click on a link inside closes it
        else if (sidebarOpen && insideSidebar && target.closest('a')) {
          sidebar.classList.add('-translate-x-full');
          sidebar.classList.remove('translate-x-0');
          if (btn) btn.setAttribute('aria-expanded', 'false');
          updateIcons(false);
          document.body.style.cursor = '';
        }
        // 3. Mobile Sidebar: Click outside closes it
        else if (sidebarOpen && !insideSidebar && !insideBtn) {
          sidebar.classList.add('-translate-x-full');
          sidebar.classList.remove('translate-x-0');
          if (btn) btn.setAttribute('aria-expanded', 'false');
          updateIcons(false);
          document.body.style.cursor = '';
        }

        // 4. Admin Sidebar: Click-Outside Closing
        if (adminAside && !adminAside.classList.contains('-translate-x-full')) {
          const isToggleBtn = target.closest('button[onclick*="aside"]') || path.some(el => el.tagName === 'BUTTON' && el.getAttribute && el.getAttribute('onclick') && el.getAttribute('onclick').includes('aside'));
          if (!insideAdminAside && !isToggleBtn) {
            adminAside.classList.add('-translate-x-full');
            adminAside.classList.remove('translate-x-0');
          }
        }
      });
    }

    // 2. Theme Management with comprehensive try-catch blocks
    // Completely safe against localStorage SecurityErrors and matchMedia compatibility issues.
    (() => {
      const html = document.documentElement;
      let stored = null;
      try {
        stored = localStorage.getItem('theme');
      } catch (e) {
        console.warn('localStorage is blocked or disabled in this browser:', e);
      }

      function applyTheme(theme) {
        if (theme === 'dark') {
          html.classList.add('dark');
        } else {
          html.classList.remove('dark');
        }
        updateIcons();
      }

      function updateIcons() {
        const isDark = html.classList.contains('dark');
        // Desktop theme icons
        const sun = document.getElementById('theme-toggle-sun');
        const moon = document.getElementById('theme-toggle-moon');
        if (sun) sun.classList.toggle('hidden', !isDark);
        if (moon) moon.classList.toggle('hidden', isDark);

        // Mobile theme icons
        const mSun = document.querySelector('.mobile-theme-sun');
        const mMoon = document.querySelector('.mobile-theme-moon');
        if (mSun) mSun.classList.toggle('hidden', !isDark);
        if (mMoon) mMoon.classList.toggle('hidden', isDark);
      }

      // Initialize: stored > system preference > light
      try {
        if (stored === 'dark' || stored === 'light') {
          applyTheme(stored);
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          applyTheme('dark');
        } else {
          applyTheme('light');
        }
      } catch (e) {
        console.warn('Error during theme initialization:', e);
        applyTheme('light'); // Safe fallback
      }

      // Listen for system preference changes (using compatible check)
      try {
        const mediaQuery = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
        if (mediaQuery) {
          const handler = (e) => {
            let hasStored = false;
            try {
              hasStored = !!localStorage.getItem('theme');
            } catch (err) {}
            if (!hasStored) {
              applyTheme(e.matches ? 'dark' : 'light');
            }
          };
          if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handler);
          } else if (mediaQuery.addListener) {
            mediaQuery.addListener(handler); // compatibility fallback for iOS <= 13
          }
        }
      } catch (e) {
        console.warn('Could not register media query listener:', e);
      }

      // Toggle handlers via Event Delegation (survives HTMX body swaps)
      document.addEventListener('click', (e) => {
        const target = e.target;
        const toggleBtn = target.closest('#theme-toggle, #mobile-theme-toggle');
        if (toggleBtn) {
          const isDark = html.classList.contains('dark');
          const newTheme = isDark ? 'light' : 'dark';
          try {
            localStorage.setItem('theme', newTheme);
          } catch (err) {
            console.warn('Could not store theme in localStorage:', err);
          }
          applyTheme(newTheme);
        }
      });
    })();

    // 3. Auto-update footer year
    const footerYear = document.getElementById('footer-year');
    if (footerYear) {
      footerYear.textContent = new Date().getFullYear();
    }

    // 4. Generic Form Validation — disables submit button until all required fields
    //    are filled, and scrolls to the first empty field on submit.
    (() => {
      function isFieldFilled(field) {
        if (field.type === 'checkbox') {
          // For checkboxes, check if at least one checkbox with this name is checked
          if (field.name) {
            const form = field.form;
            if (!form) return field.checked;
            const group = form.querySelectorAll(`[name="${CSS.escape(field.name)}"]`);
            if (group.length > 1) {
              return Array.from(group).some(cb => cb.checked);
            }
          }
          return field.checked;
        }
        if (field.type === 'radio') {
          if (!field.name) return field.checked;
          const form = field.form;
          if (!form) return field.checked;
          const group = form.querySelectorAll(`[name="${CSS.escape(field.name)}"]`);
          return Array.from(group).some(r => r.checked);
        }
        // text, email, tel, textarea, select, number, etc.
        return field.value.trim() !== '';
      }

      function getCheckboxGroupForField(field) {
        if (field.type !== 'checkbox') return [field];
        if (!field.name) return [field];
        const form = field.form;
        if (!form) return [field];
        const group = form.querySelectorAll(`[name="${CSS.escape(field.name)}"]`);
        if (group.length > 1) return Array.from(group);
        return [field];
      }

      function isGroupFilled(field) {
        const group = getCheckboxGroupForField(field);
        return group.some(f => isFieldFilled(f));
      }

      function findFirstEmpty(form) {
        const required = form.querySelectorAll('[required]');
        for (const field of required) {
          if (field.disabled) continue;
          if (field.type === 'checkbox' || field.type === 'radio') {
            if (!isGroupFilled(field)) {
              // Return the first unchecked checkbox in the group
              const group = getCheckboxGroupForField(field);
              return group.find(f => !f.checked) || field;
            }
          } else if (!isFieldFilled(field)) {
            return field;
          }
        }
        return null;
      }

      function checkAllFormsValidity() {
        document.querySelectorAll('form').forEach(form => {
          const submitBtn = form.querySelector('button[type="submit"]');
          if (!submitBtn) return;
          const required = form.querySelectorAll('[required]');
          if (required.length === 0) {
            submitBtn.disabled = false;
            return;
          }

          let allFilled = true;
          for (const field of required) {
            if (field.disabled) continue;
            if (field.type === 'checkbox' || field.type === 'radio') {
              if (!isGroupFilled(field)) { allFilled = false; break; }
            } else if (!isFieldFilled(field)) { allFilled = false; break; }
          }

          submitBtn.disabled = !allFilled;

          // Tooltip wrapper: show/hide tooltip span based on disabled state
          let wrapper = submitBtn.closest('[data-form-btn-wrap]');
          if (!wrapper && submitBtn.parentElement) {
            // Only wrap if button still has its original parent
            wrapper = document.createElement('span');
            wrapper.className = 'relative inline-block';
            wrapper.setAttribute('data-form-btn-wrap', '');
            const parent = submitBtn.parentElement;
            parent.insertBefore(wrapper, submitBtn);
            wrapper.appendChild(submitBtn);

            const tip = document.createElement('span');
            tip.className = 'form-btn-tooltip';
            tip.textContent = 'Please fill in all required fields';
            // Localize if possible
            try {
              var langEl = document.documentElement.lang || document.documentElement.getAttribute('lang');
              if (langEl && langEl.startsWith('id')) {
                tip.textContent = 'Harap isi semua bidang wajib';
              }
            } catch(e) {}
            wrapper.appendChild(tip);
          }

          const tip = wrapper ? wrapper.querySelector('.form-btn-tooltip') : null;
          if (tip) {
            tip.style.display = submitBtn.disabled ? 'block' : 'none';
          }
        });
      }

      function attachFormValidation(form) {
        const submitBtn = form.querySelector('button[type="submit"]');
        if (!submitBtn) return;
        const required = form.querySelectorAll('[required]');
        if (required.length === 0) return;

        // Suppress browser's native validation — our JS handles it
        form.setAttribute('novalidate', '');

        // Initial state
        checkAllFormsValidity();

        // Re-check on any input/change
        const events = ['input', 'change'];
        required.forEach(field => {
          events.forEach(evt => field.addEventListener(evt, checkAllFormsValidity));
          // Also listen on siblings in the same checkbox/radio group
          if ((field.type === 'checkbox' || field.type === 'radio') && field.name) {
            const group = getCheckboxGroupForField(field);
            group.forEach(sibling => {
              if (sibling !== field) {
                events.forEach(evt => sibling.addEventListener(evt, checkAllFormsValidity));
              }
            });
          }
        });

        // On submit: validate and scroll to first empty
        form.addEventListener('submit', function onSubmit(e) {
          // Button is disabled when fields empty, but re-check just in case
          if (submitBtn.disabled) {
            e.preventDefault();
            return;
          }
          const empty = findFirstEmpty(form);
          if (empty) {
            e.preventDefault();
            // Scroll to the field (or its closest label/container)
            const scrollTarget = empty.closest('fieldset, label, .mb-6, [data-field]') || empty.parentElement || empty;
            scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Focus the field
            try { empty.focus({ preventScroll: true }); } catch(e) {}
            // Highlight with red border
            empty.classList.add('border-2', 'border-red-600');
            empty.addEventListener('input', function clearError() {
              empty.classList.remove('border-2', 'border-red-600');
              empty.removeEventListener('input', clearError);
            }, { once: true });
            empty.addEventListener('change', function clearError() {
              empty.classList.remove('border-2', 'border-red-600');
              empty.removeEventListener('change', clearError);
            }, { once: true });
          }
        });
      }

      // Attach to all existing forms (safe against HTMX swaps — re-runs on init)
      document.querySelectorAll('form').forEach(attachFormValidation);

      // Observe for HTMX/swapped forms
      if (window.MutationObserver) {
        const observer = new MutationObserver(() => {
          document.querySelectorAll('form:not([data-form-validated])').forEach(form => {
            form.setAttribute('data-form-validated', '1');
            attachFormValidation(form);
          });
        });
        observer.observe(document.body, { childList: true, subtree: true });
      }
    })();
  }

  // Robust readyState check: run immediately if DOM is already parsed,
  // otherwise wait for DOMContentLoaded.
  if (document.readyState !== 'loading') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
