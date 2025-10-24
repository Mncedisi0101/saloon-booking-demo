// Supabase client initialization
function initializeSupabase() {
    // Get credentials from environment or use defaults for development
    const SUPABASE_URL = window.SUPABASE_URL || 
                        process.env.SUPABASE_URL || 
                        'https://your-project.supabase.co';
    
    const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 
                             process.env.SUPABASE_ANON_KEY || 
                             'your-anon-key';

    console.log('Initializing Supabase with URL:', SUPABASE_URL);

    // Initialize Supabase client
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
            flowType: 'pkce'
        }
    });

    // Test connection
    supabase.auth.getSession().then(({ data, error }) => {
        if (error) {
            console.warn('Supabase connection test failed:', error.message);
        } else {
            console.log('Supabase connected successfully');
        }
    });

    return supabase;
}

// Initialize when script loads
const supabase = initializeSupabase();

// Database utility functions
const db = {
    async createBusiness(businessData) {
        const { data, error } = await supabase
            .from('businesses')
            .insert([businessData])
            .select()
            .single();
        return { data, error };
    },

    async getBusinessById(id) {
        const { data, error } = await supabase
            .from('businesses')
            .select('*')
            .eq('id', id)
            .single();
        return { data, error };
    },

    async updateBusiness(id, updates) {
        const { data, error } = await supabase
            .from('businesses')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        return { data, error };
    },

    async createAppointment(appointmentData) {
        const { data, error } = await supabase
            .from('appointments')
            .insert([appointmentData])
            .select()
            .single();
        return { data, error };
    },

    async getAppointments(businessId, filters = {}) {
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

        const { data, error } = await query.order('appointment_date', { ascending: false });
        return { data, error };
    },

    async updateAppointment(id, updates) {
        const { data, error } = await supabase
            .from('appointments')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        return { data, error };
    },

    async createService(serviceData) {
        const { data, error } = await supabase
            .from('services')
            .insert([serviceData])
            .select()
            .single();
        return { data, error };
    },

    async getServices(businessId) {
        const { data, error } = await supabase
            .from('services')
            .select('*')
            .eq('business_id', businessId)
            .eq('is_active', true)
            .order('name');
        return { data, error };
    },

    async updateService(id, updates) {
        const { data, error } = await supabase
            .from('services')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        return { data, error };
    },

    async createStylist(stylistData) {
        const { data, error } = await supabase
            .from('stylists')
            .insert([stylistData])
            .select()
            .single();
        return { data, error };
    },

    async getStylists(businessId) {
        const { data, error } = await supabase
            .from('stylists')
            .select('*')
            .eq('business_id', businessId)
            .order('name');
        return { data, error };
    },

    async createCustomer(customerData) {
        const { data, error } = await supabase
            .from('customers')
            .insert([customerData])
            .select()
            .single();
        return { data, error };
    },

    async getCustomerByEmail(email) {
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .eq('email', email)
            .single();
        return { data, error };
    },

    async getBusinessStats(businessId) {
        const today = new Date().toISOString().split('T')[0];
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const { data: todayAppointments, error: todayError } = await supabase
            .from('appointments')
            .select('id, status')
            .eq('business_id', businessId)
            .gte('appointment_date', today)
            .lt('appointment_date', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

        const { data: weekAppointments, error: weekError } = await supabase
            .from('appointments')
            .select('services(price)')
            .eq('business_id', businessId)
            .eq('status', 'completed')
            .gte('appointment_date', weekAgo);

        const { data: customers, error: customersError } = await supabase
            .from('appointments')
            .select('customer_id')
            .eq('business_id', businessId);

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
    }
};

// Export for use in other files
window.supabaseClient = supabase;
window.db = db;

console.log('Supabase client initialized');