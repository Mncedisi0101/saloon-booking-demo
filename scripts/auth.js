// Auth functionality
class AuthManager {
    constructor() {
        this.supabase = window.supabaseClient;
        if (!this.supabase) {
            console.error('Supabase client not available. Make sure supabase-client.js is loaded first.');
            return;
        }
        this.init();
    }

    init() {
        this.checkAuthState();
        this.attachEventListeners();
    }

    async checkAuthState() {
        try {
            const { data: { session } } = await this.supabase.auth.getSession();
            if (session) {
                this.handleAuthenticatedUser(session.user);
            }
        } catch (error) {
            console.error('Error checking auth state:', error);
        }
    }

    handleAuthenticatedUser(user) {
        const userRole = localStorage.getItem('userRole');
        const currentPage = window.location.pathname;

        if (userRole === 'business' && !currentPage.includes('business-dashboard')) {
            window.location.href = 'pages/business-dashboard.html';
        } else if (userRole === 'customer' && !currentPage.includes('customer-dashboard')) {
            window.location.href = 'pages/customer-dashboard.html';
        } else if (userRole === 'admin' && !currentPage.includes('admin-dashboard')) {
            window.location.href = 'pages/admin-dashboard.html';
        }
    }

    attachEventListeners() {
        // Business registration form
        const businessForm = document.getElementById('businessRegisterForm');
        if (businessForm) {
            businessForm.addEventListener('submit', (e) => this.handleBusinessRegistration(e));
        }

        // Business login form
        const businessLoginForm = document.getElementById('businessLoginForm');
        if (businessLoginForm) {
            businessLoginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Customer registration form
        const customerForm = document.getElementById('customerRegisterForm');
        if (customerForm) {
            customerForm.addEventListener('submit', (e) => this.handleCustomerRegistration(e));
        }

        // Customer login form
        const customerLoginForm = document.getElementById('customerLoginForm');
        if (customerLoginForm) {
            customerLoginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Admin login form
        const adminLoginForm = document.getElementById('adminLoginForm');
        if (adminLoginForm) {
            adminLoginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Toggle between login/register
        const showLogin = document.getElementById('show-login');
        const showRegister = document.getElementById('show-register');
        
        if (showLogin && showRegister) {
            showLogin.addEventListener('click', (e) => {
                e.preventDefault();
                this.showLoginSection();
            });
            
            showRegister.addEventListener('click', (e) => {
                e.preventDefault();
                this.showRegisterSection();
            });
        }
    }

    showLoginSection() {
        const loginSection = document.getElementById('login-section');
        const registerSection = document.getElementById('register-section');
        
        if (loginSection && registerSection) {
            loginSection.classList.add('active');
            registerSection.classList.remove('active');
        }
    }

    showRegisterSection() {
        const loginSection = document.getElementById('login-section');
        const registerSection = document.getElementById('register-section');
        
        if (loginSection && registerSection) {
            loginSection.classList.remove('active');
            registerSection.classList.add('active');
        }
    }

    async handleBusinessRegistration(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const businessData = {
            owner_name: formData.get('ownerName'),
            business_name: formData.get('businessName'),
            email: formData.get('email'),
            phone_number: formData.get('phoneNumber'),
            password: formData.get('password'),
            terms_accepted: formData.get('terms') === 'on'
        };

        if (!this.validateBusinessForm(businessData)) {
            return;
        }

        try {
            const { data: authData, error: authError } = await this.supabase.auth.signUp({
                email: businessData.email,
                password: businessData.password,
                options: {
                    data: {
                        user_type: 'business',
                        owner_name: businessData.owner_name
                    }
                }
            });

            if (authError) throw authError;

            const { data: businessRecord, error: businessError } = await window.db.createBusiness({
                owner_name: businessData.owner_name,
                business_name: businessData.business_name,
                email: businessData.email,
                phone_number: businessData.phone_number,
                user_id: authData.user.id,
                is_active: true
            });

            if (businessError) throw businessError;

            localStorage.setItem('userRole', 'business');
            localStorage.setItem('businessId', businessRecord.id);
            
            this.showNotification('Business registered successfully! Please check your email for verification.', 'success');
            setTimeout(() => {
                window.location.href = 'pages/business-dashboard.html';
            }, 2000);

        } catch (error) {
            console.error('Registration error:', error);
            this.showNotification('Registration failed: ' + error.message, 'error');
        }
    }

    async handleCustomerRegistration(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const customerData = {
            first_name: formData.get('firstName'),
            last_name: formData.get('lastName'),
            email: formData.get('email'),
            country: formData.get('country'),
            phone_number: formData.get('phoneNumber'),
            password: formData.get('password'),
            terms_accepted: formData.get('terms') === 'on'
        };

        if (!this.validateCustomerForm(customerData)) {
            return;
        }

        try {
            const { data: authData, error: authError } = await this.supabase.auth.signUp({
                email: customerData.email,
                password: customerData.password,
                options: {
                    data: {
                        user_type: 'customer',
                        first_name: customerData.first_name,
                        last_name: customerData.last_name
                    }
                }
            });

            if (authError) throw authError;

            const { data: customerRecord, error: customerError } = await window.db.createCustomer({
                first_name: customerData.first_name,
                last_name: customerData.last_name,
                email: customerData.email,
                country: customerData.country,
                phone_number: customerData.phone_number,
                user_id: authData.user.id
            });

            if (customerError) throw customerError;

            localStorage.setItem('userRole', 'customer');
            localStorage.setItem('customerId', customerRecord.id);
            
            this.showNotification('Registration successful! Please check your email for verification.', 'success');
            setTimeout(() => {
                window.location.href = 'pages/customer-dashboard.html';
            }, 2000);

        } catch (error) {
            console.error('Registration error:', error);
            this.showNotification('Registration failed: ' + error.message, 'error');
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const credentials = {
            email: formData.get('email'),
            password: formData.get('password'),
            userType: formData.get('userType') || 'customer'
        };

        try {
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email: credentials.email,
                password: credentials.password
            });

            if (error) throw error;

            let userRole = credentials.userType;
            if (credentials.userType !== 'admin') {
                const businessCheck = await window.db.getBusinessByUserId(data.user.id);
                userRole = businessCheck.data ? 'business' : 'customer';
            }

            localStorage.setItem('userRole', userRole);
            
            this.showNotification('Login successful! Redirecting...', 'success');
            
            setTimeout(() => {
                if (userRole === 'business') {
                    window.location.href = 'pages/business-dashboard.html';
                } else if (userRole === 'customer') {
                    window.location.href = 'pages/customer-dashboard.html';
                } else if (userRole === 'admin') {
                    window.location.href = 'pages/admin-dashboard.html';
                }
            }, 1000);

        } catch (error) {
            console.error('Login error:', error);
            this.showNotification('Login failed: ' + error.message, 'error');
        }
    }

    validateBusinessForm(data) {
        const errors = {};
        if (!data.owner_name || data.owner_name.length < 3) {
            errors.ownerName = 'Owner name must be at least 3 characters';
        }
        if (!data.business_name || data.business_name.length < 3) {
            errors.businessName = 'Business name must be at least 3 characters';
        }
        if (!this.isValidEmail(data.email)) {
            errors.email = 'Please enter a valid email address';
        }
        if (!this.isValidPhone(data.phone_number)) {
            errors.phoneNumber = 'Please enter a valid phone number with country code';
        }
        if (!this.isValidPassword(data.password)) {
            errors.password = 'Password must be at least 8 characters with 1 uppercase, 1 number, and 1 special character';
        }
        if (!data.terms_accepted) {
            errors.terms = 'You must accept the terms and conditions';
        }
        this.displayFormErrors(errors);
        return Object.keys(errors).length === 0;
    }

    validateCustomerForm(data) {
        const errors = {};
        if (!data.first_name || data.first_name.length < 2) {
            errors.firstName = 'First name must be at least 2 characters';
        }
        if (!data.last_name || data.last_name.length < 2) {
            errors.lastName = 'Last name must be at least 2 characters';
        }
        if (!this.isValidEmail(data.email)) {
            errors.email = 'Please enter a valid email address';
        }
        if (!data.country) {
            errors.country = 'Please select your country';
        }
        if (!this.isValidPhone(data.phone_number)) {
            errors.phoneNumber = 'Please enter a valid phone number';
        }
        if (!this.isValidPassword(data.password)) {
            errors.password = 'Password must be at least 8 characters with 1 uppercase, 1 number, and 1 special character';
        }
        if (!data.terms_accepted) {
            errors.terms = 'You must accept the terms and conditions';
        }
        this.displayFormErrors(errors);
        return Object.keys(errors).length === 0;
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    isValidPhone(phone) {
        const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
        return phoneRegex.test(phone);
    }

    isValidPassword(password) {
        const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        return passwordRegex.test(password);
    }

    displayFormErrors(errors) {
        document.querySelectorAll('.error-message').forEach(el => {
            el.style.display = 'none';
        });
        document.querySelectorAll('.form-group').forEach(el => {
            el.classList.remove('error');
        });

        Object.keys(errors).forEach(field => {
            const errorElement = document.getElementById(`${field}Error`);
            const formGroup = document.querySelector(`[name="${field}"]`)?.closest('.form-group');
            
            if (errorElement && formGroup) {
                errorElement.textContent = errors[field];
                errorElement.style.display = 'block';
                formGroup.classList.add('error');
            }
        });
    }

    showNotification(message, type = 'info') {
        // Remove existing notifications
        document.querySelectorAll('.notification').forEach(el => el.remove());

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">&times;</button>
        `;

        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: ${type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : '#3B82F6'};
            color: white;
            padding: 1rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            z-index: 1000;
            display: flex;
            align-items: center;
            gap: 1rem;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    async logout() {
        try {
            await this.supabase.auth.signOut();
            localStorage.removeItem('userRole');
            localStorage.removeItem('businessId');
            localStorage.removeItem('customerId');
            window.location.href = '../index.html';
        } catch (error) {
            console.error('Logout error:', error);
        }
    }
}

// Initialize auth manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
});