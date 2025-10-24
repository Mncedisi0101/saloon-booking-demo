// Auth functionality
class AuthManager {
    constructor() {
        this.supabase = window.supabaseClient;
        this.init();
    }

    init() {
        this.checkAuthState();
        this.attachEventListeners();
    }

    async checkAuthState() {
        if (!this.supabase) {
            console.error('Supabase client not available');
            return;
        }

        const { data: { session } } = await this.supabase.auth.getSession();
        if (session) {
            this.handleAuthenticatedUser(session.user);
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
            
            alert('Business registered successfully! Please check your email for verification.');
            window.location.href = 'pages/business-dashboard.html';

        } catch (error) {
            console.error('Registration error:', error);
            alert('Registration failed: ' + error.message);
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
            
            alert('Registration successful! Please check your email for verification.');
            window.location.href = 'pages/customer-dashboard.html';

        } catch (error) {
            console.error('Registration error:', error);
            alert('Registration failed: ' + error.message);
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
            if (credentials.userType === 'admin') {
                userRole = 'admin';
            } else {
                const businessCheck = await window.db.getBusinessByUserId(data.user.id);
                userRole = businessCheck.data ? 'business' : 'customer';
            }

            localStorage.setItem('userRole', userRole);
            
            if (userRole === 'business') {
                window.location.href = 'pages/business-dashboard.html';
            } else if (userRole === 'customer') {
                window.location.href = 'pages/customer-dashboard.html';
            } else if (userRole === 'admin') {
                window.location.href = 'pages/admin-dashboard.html';
            }

        } catch (error) {
            console.error('Login error:', error);
            alert('Login failed: ' + error.message);
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