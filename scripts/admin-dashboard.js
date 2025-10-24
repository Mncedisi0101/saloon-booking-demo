class AdminDashboard {
    constructor() {
        this.init();
    }

    async init() {
        await this.checkAuth();
        this.setupEventListeners();
        await this.loadDashboardData();
    }

    async checkAuth() {
        const { data: { session } } = await supabase.auth.getSession();
        const userRole = localStorage.getItem('userRole');
        
        if (!session || userRole !== 'admin') {
            window.location.href = '../index.html';
            return;
        }
    }

    setupEventListeners() {
        // Sidebar navigation
        document.querySelectorAll('.sidebar-menu a').forEach(link => {
            if (link.id !== 'adminLogoutBtn') {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const page = link.getAttribute('data-page');
                    this.showPage(page);
                });
            }
        });

        // Logout
        document.getElementById('adminLogoutBtn').addEventListener('click', () => {
            authManager.logout();
        });

        // Export buttons
        document.getElementById('exportBusinesses')?.addEventListener('click', () => {
            this.exportBusinesses();
        });

        document.getElementById('exportAppointments')?.addEventListener('click', () => {
            this.exportAppointments();
        });
    }

    showPage(pageName) {
        // Hide all pages
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });

        // Remove active class from all sidebar links
        document.querySelectorAll('.sidebar-menu a').forEach(link => {
            link.classList.remove('active');
        });

        // Show selected page and activate sidebar link
        document.getElementById(`${pageName}-page`).classList.add('active');
        document.querySelector(`[data-page="${pageName}"]`).classList.add('active');

        // Load page-specific data
        switch (pageName) {
            case 'dashboard':
                this.loadDashboardData();
                break;
            case 'businesses':
                this.loadBusinesses();
                break;
            case 'appointments':
                this.loadAllAppointments();
                break;
            case 'analytics':
                this.loadAnalytics();
                break;
        }
    }

    async loadDashboardData() {
        try {
            // Load admin stats
            const stats = await this.getAdminStats();
            this.renderAdminStats(stats);

            // Load top businesses
            await this.loadTopBusinesses();

            // Load recent activity
            await this.loadRecentActivity();

        } catch (error) {
            console.error('Error loading admin dashboard data:', error);
        }
    }

    async getAdminStats() {
        // Total businesses
        const { data: businesses, error: businessesError } = await supabase
            .from('businesses')
            .select('id, is_active, created_at');

        // Total appointments
        const { data: appointments, error: appointmentsError } = await supabase
            .from('appointments')
            .select('id, status, appointment_date, total_amount');

        // Total customers
        const { data: customers, error: customersError } = await supabase
            .from('customers')
            .select('id');

        if (businessesError || appointmentsError || customersError) {
            throw new Error('Error loading stats');
        }

        const today = new Date().toISOString().split('T')[0];
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const todayAppointments = appointments.filter(a => a.appointment_date === today);
        const weekAppointments = appointments.filter(a => a.appointment_date >= weekAgo);
        const weekRevenue = weekAppointments
            .filter(a => a.status === 'completed')
            .reduce((sum, a) => sum + (a.total_amount || 0), 0);

        return {
            totalBusinesses: businesses.length,
            activeBusinesses: businesses.filter(b => b.is_active).length,
            totalAppointments: appointments.length,
            todayAppointments: todayAppointments.length,
            weekRevenue: weekRevenue,
            totalCustomers: customers.length,
            conversionRate: ((businesses.length / 100) * 100).toFixed(1) // Mock conversion rate
        };
    }

    renderAdminStats(stats) {
        const statsGrid = document.getElementById('adminStatsGrid');
        statsGrid.innerHTML = `
            <div class="stat-card">
                <h3>Total Businesses</h3>
                <div class="stat-value">${stats.totalBusinesses}</div>
                <div class="stat-trend">${stats.activeBusinesses} active</div>
            </div>
            <div class="stat-card">
                <h3>Total Appointments</h3>
                <div class="stat-value">${stats.totalAppointments}</div>
                <div class="stat-trend">${stats.todayAppointments} today</div>
            </div>
            <div class="stat-card">
                <h3>Weekly Revenue</h3>
                <div class="stat-value">$${stats.weekRevenue}</div>
                <div class="stat-trend">Across all businesses</div>
            </div>
            <div class="stat-card">
                <h3>Total Customers</h3>
                <div class="stat-value">${stats.totalCustomers}</div>
                <div class="stat-trend">Conversion: ${stats.conversionRate}%</div>
            </div>
        `;
    }

    async loadTopBusinesses() {
        try {
            const { data: businesses, error } = await supabase
                .from('businesses')
                .select(`
                    *,
                    appointments(count),
                    appointments!inner(total_amount)
                `)
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(5);

            if (error) throw error;

            this.renderTopBusinesses(businesses);

        } catch (error) {
            console.error('Error loading top businesses:', error);
        }
    }

    renderTopBusinesses(businesses) {
        const container = document.getElementById('topBusinessesList');
        
        if (!businesses || businesses.length === 0) {
            container.innerHTML = '<p>No businesses found</p>';
            return;
        }

        container.innerHTML = businesses.map(business => `
            <div class="business-item">
                <div class="business-info">
                    <h4>${business.business_name}</h4>
                    <p>${business.owner_name} • ${business.appointments?.length || 0} appointments</p>
                </div>
                <div class="business-status ${business.is_active ? 'active' : 'inactive'}">
                    ${business.is_active ? 'Active' : 'Inactive'}
                </div>
            </div>
        `).join('');
    }

    async loadRecentActivity() {
        try {
            const { data: appointments, error } = await supabase
                .from('appointments')
                .select(`
                    *,
                    businesses(business_name),
                    customers(first_name, last_name),
                    services(name)
                `)
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) throw error;

            this.renderRecentActivity(appointments);

        } catch (error) {
            console.error('Error loading recent activity:', error);
        }
    }

    renderRecentActivity(appointments) {
        const container = document.getElementById('recentActivityList');
        
        if (!appointments || appointments.length === 0) {
            container.innerHTML = '<p>No recent activity</p>';
            return;
        }

        container.innerHTML = appointments.map(appointment => `
            <div class="activity-item">
                <div class="activity-icon">
                    <i class="fas fa-calendar-plus"></i>
                </div>
                <div class="activity-details">
                    <p><strong>${appointment.customers.first_name} ${appointment.customers.last_name}</strong> booked ${appointment.services.name}</p>
                    <small>${appointment.businesses.business_name} • ${new Date(appointment.created_at).toLocaleString()}</small>
                </div>
                <div class="activity-status status-${appointment.status}">
                    ${appointment.status}
                </div>
            </div>
        `).join('');
    }

    async loadBusinesses() {
        try {
            const { data: businesses, error } = await supabase
                .from('businesses')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.renderBusinessesTable(businesses);

        } catch (error) {
            console.error('Error loading businesses:', error);
        }
    }

    renderBusinessesTable(businesses) {
        const tbody = document.querySelector('#businessesTable tbody');
        
        if (!businesses || businesses.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No businesses found</td></tr>';
            return;
        }

        tbody.innerHTML = businesses.map(business => `
            <tr>
                <td>${business.business_name}</td>
                <td>${business.owner_name}</td>
                <td>${business.email}</td>
                <td>${business.phone_number}</td>
                <td>
                    <span class="status-badge ${business.is_active ? 'status-active' : 'status-inactive'}">
                        ${business.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>${new Date(business.created_at).toLocaleDateString()}</td>
                <td>
                    <button class="btn-sm" onclick="adminDashboard.viewBusiness('${business.id}')">View</button>
                    <button class="btn-sm ${business.is_active ? 'btn-warning' : 'btn-success'}" 
                            onclick="adminDashboard.toggleBusinessStatus('${business.id}', ${!business.is_active})">
                        ${business.is_active ? 'Suspend' : 'Activate'}
                    </button>
                    <button class="btn-sm btn-danger" onclick="adminDashboard.deleteBusiness('${business.id}')">Delete</button>
                </td>
            </tr>
        `).join('');
    }

    async loadAllAppointments() {
        try {
            const { data: appointments, error } = await supabase
                .from('appointments')
                .select(`
                    *,
                    businesses(business_name),
                    customers(first_name, last_name),
                    services(name, price)
                `)
                .order('appointment_date', { ascending: false })
                .order('appointment_time', { ascending: false });

            if (error) throw error;

            this.renderAllAppointmentsTable(appointments);

        } catch (error) {
            console.error('Error loading appointments:', error);
        }
    }

    renderAllAppointmentsTable(appointments) {
        const tbody = document.querySelector('#allAppointmentsTable tbody');
        
        if (!appointments || appointments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No appointments found</td></tr>';
            return;
        }

        tbody.innerHTML = appointments.map(appointment => `
            <tr>
                <td>${appointment.id.slice(-6)}</td>
                <td>${appointment.businesses.business_name}</td>
                <td>${appointment.customers.first_name} ${appointment.customers.last_name}</td>
                <td>${appointment.services.name}</td>
                <td>${new Date(appointment.appointment_date).toLocaleDateString()}</td>
                <td>${appointment.appointment_time}</td>
                <td><span class="status-badge status-${appointment.status}">${appointment.status}</span></td>
                <td>$${appointment.services.price}</td>
            </tr>
        `).join('');
    }

    async toggleBusinessStatus(businessId, newStatus) {
        try {
            const { error } = await supabase
                .from('businesses')
                .update({ is_active: newStatus })
                .eq('id', businessId);

            if (error) throw error;

            this.showNotification(`Business ${newStatus ? 'activated' : 'suspended'} successfully`, 'success');
            this.loadBusinesses();

        } catch (error) {
            console.error('Error updating business status:', error);
            this.showNotification('Failed to update business status', 'error');
        }
    }

    async deleteBusiness(businessId) {
        if (!confirm('Are you sure you want to delete this business? This action cannot be undone.')) {
            return;
        }

        try {
            const { error } = await supabase
                .from('businesses')
                .delete()
                .eq('id', businessId);

            if (error) throw error;

            this.showNotification('Business deleted successfully', 'success');
            this.loadBusinesses();

        } catch (error) {
            console.error('Error deleting business:', error);
            this.showNotification('Failed to delete business', 'error');
        }
    }

    exportBusinesses() {
        // Simple CSV export implementation
        const table = document.getElementById('businessesTable');
        const rows = table.querySelectorAll('tr');
        let csv = [];

        rows.forEach(row => {
            const rowData = [];
            row.querySelectorAll('th, td').forEach(cell => {
                // Exclude action buttons
                if (!cell.querySelector('button')) {
                    rowData.push(cell.textContent.trim());
                }
            });
            csv.push(rowData.join(','));
        });

        this.downloadCSV(csv.join('\n'), 'businesses.csv');
    }

    exportAppointments() {
        const table = document.getElementById('allAppointmentsTable');
        const rows = table.querySelectorAll('tr');
        let csv = [];

        rows.forEach(row => {
            const rowData = [];
            row.querySelectorAll('th, td').forEach(cell => {
                rowData.push(cell.textContent.trim());
            });
            csv.push(rowData.join(','));
        });

        this.downloadCSV(csv.join('\n'), 'appointments.csv');
    }

    downloadCSV(csv, filename) {
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', filename);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    showNotification(message, type = 'info') {
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
}

// Initialize admin dashboard
document.addEventListener('DOMContentLoaded', () => {
    window.adminDashboard = new AdminDashboard();
});