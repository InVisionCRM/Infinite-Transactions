/**
 * @fileoverview Sidebar navigation module
 * Handles sidebar toggle, section switching, and mobile optimization
 */

/**
 * Initialize sidebar navigation
 */
export function initializeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebarClose = document.getElementById('sidebarClose');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.settings-section');

    // Toggle sidebar on mobile
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebar?.classList.add('active');
            sidebarOverlay?.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    }

    // Close sidebar
    const closeSidebar = () => {
        sidebar?.classList.remove('active');
        sidebarOverlay?.classList.remove('active');
        document.body.style.overflow = '';
    };

    if (sidebarClose) {
        sidebarClose.addEventListener('click', closeSidebar);
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeSidebar);
    }

    // Section switching
    navItems.forEach(navItem => {
        navItem.addEventListener('click', () => {
            const sectionName = navItem.dataset.section;

            // Update active nav item
            navItems.forEach(item => item.classList.remove('active'));
            navItem.classList.add('active');

            // Show corresponding section
            sections.forEach(section => {
                if (section.dataset.section === sectionName) {
                    section.classList.add('active');
                } else {
                    section.classList.remove('active');
                }
            });

            // Close sidebar on mobile after selection
            if (window.innerWidth <= 1024) {
                closeSidebar();
            }
        });
    });

    // Handle escape key to close sidebar
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar?.classList.contains('active')) {
            closeSidebar();
        }
    });

    // Handle window resize
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            // Close sidebar when resizing to desktop
            if (window.innerWidth > 1024) {
                closeSidebar();
            }
        }, 250);
    });
}
