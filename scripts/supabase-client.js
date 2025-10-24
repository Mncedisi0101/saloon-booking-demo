// Supabase configuration with environment variables
class SupabaseConfig {
    constructor() {
        this.SUPABASE_URL = this.getSupabaseUrl();
        this.SUPABASE_ANON_KEY = this.getSupabaseAnonKey();
        this.init();
    }

    getSupabaseUrl() {
        // Try different environment variable names for different platforms
        return process.env.SUPABASE_URL || 
               process.env.VITE_SUPABASE_URL ||
               process.env.NEXT_PUBLIC_SUPABASE_URL ||
               import.meta.env?.VITE_SUPABASE_URL ||
               import.meta.env?.SUPABASE_URL ||
               window.env?.SUPABASE_URL ||
               this.getFromNetlifyEnv() ||
               'https://your-project.supabase.co'; // Fallback for local development
    }

    getSupabaseAnonKey() {
        // Try different environment variable names for different platforms
        return process.env.SUPABASE_ANON_KEY || 
               process.env.VITE_SUPABASE_ANON_KEY ||
               process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
               import.meta.env?.VITE_SUPABASE_ANON_KEY ||
               import.meta.env?.SUPABASE_ANON_KEY ||
               window.env?.SUPABASE_ANON_KEY ||
               this.getFromNetlifyEnv('SUPABASE_ANON_KEY') ||
               'your-anon-key'; // Fallback for local development
    }

    getFromNetlifyEnv(key = 'SUPABASE_URL') {
        // Netlify injects environment variables during build
        // For client-side, we need to use a different approach
        try {
            if (typeof window !== 'undefined' && window.netlifyEnv) {
                return window.netlifyEnv[key];
            }
        } catch (error) {
            console.warn('Netlify env not available:', error);
        }
        return null;
    }

    init() {
        console.log('Supabase Config Initialized');
        console.log('URL Available:', !!this.SUPABASE_URL && this.SUPABASE_URL !== 'https://your-project.supabase.co');
        console.log('Key Available:', !!this.SUPABASE_ANON_KEY && this.SUPABASE_ANON_KEY !== 'your-anon-key');
        
        if (this.SUPABASE_URL === 'https://your-project.supabase.co' || 
            this.SUPABASE_ANON_KEY === 'your-anon-key') {
            console.warn('Using default Supabase credentials. Please set environment variables in production.');
        }
    }
}

// Initialize configuration
const config = new SupabaseConfig();

// Initialize Supabase client
const supabase = supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce'
    },
    realtime: {
        params: {
            eventsPerSecond: 10
        }
    }
});

// Test connection on startup
async function testSupabaseConnection() {
    try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
            console.warn('Supabase connection test failed:', error.message);
        } else {
            console.log('Supabase connected successfully');
        }
    } catch (error) {
        console.error('Supabase connection error:', error);
    }
}

// Call connection test after a short delay
setTimeout(testSupabaseConnection, 1000);

// Auth state listener
supabase.auth.onAuthStateChange((event, session) => {
    console.log('Auth state changed:', event, session ? 'User logged in' : 'User logged out');
    
    if (event === 'SIGNED_IN') {
        console.log('User signed in:', session.user);
        // Redirect based on user role
        const userRole = localStorage.getItem('userRole');
        const currentPath = window.location.pathname;
        
        // Don't redirect if we're already on the correct dashboard
        if (userRole === 'business' && !currentPath.includes('business-dashboard')) {
            window.location.href = 'pages/business-dashboard.html';
        } else if (userRole === 'customer' && !currentPath.includes('customer-dashboard')) {
            window.location.href = 'pages/customer-dashboard.html';
        } else if (userRole === 'admin' && !currentPath.includes('admin-dashboard')) {
            window.location.href = 'pages/admin-dashboard.html';
        }
    } else if (event === 'SIGNED_OUT') {
        console.log('User signed out');
        localStorage.removeItem('userRole');
        localStorage.removeItem('businessId');
        localStorage.removeItem('customerId');
        
        // Redirect to home page if on a dashboard
        if (window.location.pathname.includes('dashboard')) {
            window.location.href = '../index.html';
        }
    } else if (event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed');
    } else if (event === 'USER_UPDATED') {
        console.log('User updated');
    }
});

// Enhanced error handling
supabase.handleError = (error) => {
    console.error('Supabase Error:', error);
    
    if (error.message?.includes('JWT')) {
        console.warn('Authentication error, signing out...');
        supabase.auth.signOut();
    }
    
    return {
        success: false,
        error: error.message,
        code: error.code
    };
};

// Utility functions with enhanced error handling
const db = {
    // Business operations
    async createBusiness(businessData) {
        try {
            const { data, error } = await supabase
                .from('businesses')
                .insert([businessData])
                .select()
                .single();
                
            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            return supabase.handleError(error);
        }
    },

    async getBusinessById(id) {
        try {
            const { data, error } = await supabase
                .from('businesses')
                .select('*')
                .eq('id', id)
                .single();
                
            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            return supabase.handleError(error);
        }
    },

    async getBusinessByUserId(userId) {
        try {
            const { data, error } = await supabase
                .from('businesses')
                .select('*')
                .eq('user_id', userId)
                .single();
                
            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            return supabase.handleError(error);
        }
    },

    async updateBusiness(id, updates) {
        try {
            const { data, error } = await supabase
                .from('businesses')
                .update(updates)
                .eq('id', id)
                .select()
                .single();
                
            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            return supabase.handleError(error);
        }
    },

    // Appointment operations
    async createAppointment(appointmentData) {
        try {
            const { data, error } = await supabase
                .from('appointments')
                .insert([appointmentData])
                .select()
                .single();
                
            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            return supabase.handleError(error);
        }
    },

    async getAppointments(businessId, filters = {}) {
        try {
            let query = supabase
                .from('appointments')
                .select(`
                    *,
                    customers(first_name, last_name, email),
                    services(name, price),
                    stylists(name)
                `)
                .eq('business_id', businessId);

            if (filters.status) query = query.eq('status', filters.status);
            if (filters.date_from) query = query.gte('appointment_date', filters.date_from);
            if (filters.date_to) query = query.lte('appointment_date', filters.date_to);
            if (filters.limit) query = query.limit(filters.limit);

            const { data, error } = await query.order('appointment_date', { ascending: false });
            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            return supabase.handleError(error);
        }
    },

    async updateAppointment(id, updates) {
        try {
            const { data, error } = await supabase
                .from('appointments')
                .update(updates)
                .eq('id', id)
                .select()
                .single();
                
            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            return supabase.handleError(error);
        }
    },

    // Service operations
    async createService(serviceData) {
        try {
            const { data, error } = await supabase
                .from('services')
                .insert([serviceData])
                .select()
                .single();
                
            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            return supabase.handleError(error);
        }
    },

    async getServices(businessId) {
        try {
            const { data, error } = await supabase
                .from('services')
                .select('*')
                .eq('business_id', businessId)
                .eq('is_active', true)
                .order('name');
                
            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            return supabase.handleError(error);
        }
    },

    async updateService(id, updates) {
        try {
            const { data, error } = await supabase
                .from('services')
                .update(updates)
                .eq('id', id)
                .select()
                .single();
                
            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            return supabase.handleError(error);
        }
    },

    // Stylist operations
    async createStylist(stylistData) {
        try {
            const { data, error } = await supabase
                .from('stylists')
                .insert([stylistData])
                .select()
                .single();
                
            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            return supabase.handleError(error);
        }
    },

    async getStylists(businessId) {
        try {
            const { data, error } = await supabase
                .from('stylists')
                .select('*')
                .eq('business_id', businessId)
                .order('name');
                
            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            return supabase.handleError(error);
        }
    },

    // Customer operations
    async createCustomer(customerData) {
        try {
            const { data, error } = await supabase
                .from('customers')
                .insert([customerData])
                .select()
                .single();
                
            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            return supabase.handleError(error);
        }
    },

    async getCustomerByEmail(email) {
        try {
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .eq('email', email)
                .single();
                
            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            return supabase.handleError(error);
        }
    },

    // Analytics
    async getBusinessStats(businessId) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            // Today's appointments
            const { data: todayAppointments, error: todayError } = await supabase
                .from('appointments')
                .select('id, status')
                .eq('business_id', businessId)
                .gte('appointment_date', today)
                .lt('appointment_date', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

            if (todayError) throw todayError;

            // Weekly revenue
            const { data: weekAppointments, error: weekError } = await supabase
                .from('appointments')
                .select('services(price)')
                .eq('business_id', businessId)
                .eq('status', 'completed')
                .gte('appointment_date', weekAgo);

            if (weekError) throw weekError;

            // Total customers
            const { data: customers, error: customersError } = await supabase
                .from('appointments')
                .select('customer_id')
                .eq('business_id', businessId);

            if (customersError) throw customersError;

            const uniqueCustomers = new Set(customers?.map(a => a.customer_id)).size;
            const weekRevenue = weekAppointments?.reduce((sum, appointment) => 
                sum + (appointment.services?.price || 0), 0) || 0;

            return {
                todayAppointments: todayAppointments?.length || 0,
                weekRevenue,
                totalCustomers: uniqueCustomers,
                pendingAppointments: todayAppointments?.filter(a => a.status === 'pending').length || 0,
                completedToday: todayAppointments?.filter(a => a.status === 'completed').length || 0
            };
        } catch (error) {
            console.error('Error getting business stats:', error);
            return {
                todayAppointments: 0,
                weekRevenue: 0,
                totalCustomers: 0,
                pendingAppointments: 0,
                completedToday: 0
            };
        }
    }
};

// Export for use in other files
window.supabase = supabase;
window.db = db;
window.supabaseConfig = config;

// Development helper - only in development
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window._supabase = supabase;
    console.log('Supabase development helpers available');
}