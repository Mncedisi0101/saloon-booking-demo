class BusinessDashboard {
    constructor() {
        this.businessId = localStorage.getItem('businessId');
        this.currentBusiness = null;
        this.init();
    }

    async init() {
        await this.checkAuth();
        await this.loadBusinessData();
        this.setupEventListeners();
        await this.loadDashboardData();
    }

    async checkAuth() {
        const { data: { session } } = await supabase.auth.getSession();
        const userRole = localStorage.getItem('userRole');
        
        if (!session || userRole !== 'business') {
            window.location.href = '../index.html';
            return;
        }
    }

    async loadBusinessData() {
        try {
            const { data, error } = await supabase
                .from('businesses')
                .select('*')
                .eq('user_id', (await supabase.auth.getUser()).data.user.id)
                .single();

            if (error) throw error;

            this.currentBusiness = data;
            this.businessId = data.id;
            localStorage.setItem('businessId', data.id);
            
            // Update UI
            document.getElementById('businessName').textContent = data.business_name;
        } catch (error) {
            console.error('Error loading business data:', error);
        }
    }

    setupEventListeners() {
        // Sidebar navigation
        document.querySelectorAll('.sidebar-menu a').forEach(link => {
            if (link.id !== 'logoutBtn') {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const page = link.getAttribute('data-page');
                    this.showPage(page);
                });
            }
        });

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => {
            authManager.logout();
        });

        // Service modal
        document.getElementById('addServiceBtn').addEventListener('click', () => {
            this.showServiceModal();
        });

        document.querySelector('#serviceModal .close').addEventListener('click', () => {
            this.hideServiceModal();
        });

        document.getElementById('serviceForm').addEventListener('submit', (e) => {
            this.handleServiceSubmit(e);
        });

        // QR Code actions
        document.getElementById('downloadQR').addEventListener('click', () => {
            this.downloadQRCode();
        });

        document.getElementById('printQR').addEventListener('click', () => {
            this.printQRCode();
        });

        // Appointments filter
        document.getElementById('applyFilters').addEventListener('click', () => {
            this.loadAppointments();
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
            case 'appointments':
                this.loadAppointments();
                break;
            case 'services':
                this.loadServices();
                break;
            case 'stylists':
                this.loadStylists();
                break;
            case 'qrcode':
                this.generateQRCode();
                break;
        }
    }

    async loadDashboardData() {
        if (!this.businessId) return;

        try {
            // Load stats
            const stats = await db.getBusinessStats(this.businessId);
            this.renderStats(stats);

            // Load recent appointments
            const { data: appointments, error } = await db.getAppointments(this.businessId, { 
                limit: 5 
            });

            if (error) throw error;
            this.renderRecentAppointments(appointments);

        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    }

    renderStats(stats) {
        const statsGrid = document.getElementById('statsGrid');
        statsGrid.innerHTML = `
            <div class="stat-card">
                <h3>Today's Appointments</h3>
                <div class="stat-value">${stats.todayAppointments}</div>
                <div class="stat-trend">${stats.pendingAppointments} pending</div>
            </div>
            <div class="stat-card">
                <h3>Weekly Revenue</h3>
                <div class="stat-value">$${stats.weekRevenue}</div>
                <div class="stat-trend">${stats.completedToday} completed today</div>
            </div>
            <div class="stat-card">
                <h3>Total Customers</h3>
                <div class="stat-value">${stats.totalCustomers}</div>
                <div class="stat-trend">+5 this week</div>
            </div>
            <div class="stat-card">
                <h3>Average Rating</h3>
                <div class="stat-value">4.8</div>
                <div class="stat-trend">Based on 124 reviews</div>
            </div>
        `;
    }

    renderRecentAppointments(appointments) {
        const tbody = document.querySelector('#recentAppointmentsTable tbody');
        
        if (!appointments || appointments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No recent appointments</td></tr>';
            return;
        }

        tbody.innerHTML = appointments.map(appointment => `
            <tr>
                <td>${appointment.customers?.first_name} ${appointment.customers?.last_name}</td>
                <td>${appointment.services?.name}</td>
                <td>${new Date(appointment.appointment_date).toLocaleDateString()} ${appointment.appointment_time}</td>
                <td><span class="status-badge status-${appointment.status}">${appointment.status}</span></td>
                <td>
                    <button class="btn-sm" onclick="businessDashboard.viewAppointment('${appointment.id}')">View</button>
                </td>
            </tr>
        `).join('');
    }

    async loadAppointments() {
        if (!this.businessId) return;

        try {
            const statusFilter = document.getElementById('statusFilter').value;
            const dateFrom = document.getElementById('dateFromFilter').value;
            const dateTo = document.getElementById('dateToFilter').value;

            const filters = {};
            if (statusFilter) filters.status = statusFilter;
            if (dateFrom) filters.date_from = dateFrom;
            if (dateTo) filters.date_to = dateTo;

            const { data: appointments, error } = await db.getAppointments(this.businessId, filters);

            if (error) throw error;
            this.renderAppointmentsTable(appointments);

        } catch (error) {
            console.error('Error loading appointments:', error);
        }
    }

    renderAppointmentsTable(appointments) {
        const tbody = document.querySelector('#appointmentsTable tbody');
        
        if (!appointments || appointments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No appointments found</td></tr>';
            return;
        }

        tbody.innerHTML = appointments.map(appointment => `
            <tr>
                <td>${appointment.id.slice(-6)}</td>
                <td>${appointment.customers?.first_name} ${appointment.customers?.last_name}</td>
                <td>${appointment.services?.name}</td>
                <td>${appointment.stylists?.name || 'Not assigned'}</td>
                <td>${new Date(appointment.appointment_date).toLocaleDateString()}</td>
                <td>${appointment.appointment_time}</td>
                <td>
                    <select class="status-select" data-appointment-id="${appointment.id}">
                        <option value="pending" ${appointment.status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="confirmed" ${appointment.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                        <option value="completed" ${appointment.status === 'completed' ? 'selected' : ''}>Completed</option>
                        <option value="cancelled" ${appointment.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                </td>
                <td>
                    <button class="btn-sm" onclick="businessDashboard.editAppointment('${appointment.id}')">Edit</button>
                    <button class="btn-sm btn-danger" onclick="businessDashboard.deleteAppointment('${appointment.id}')">Delete</button>
                </td>
            </tr>
        `).join('');

        // Add event listeners for status changes
        document.querySelectorAll('.status-select').forEach(select => {
            select.addEventListener('change', (e) => {
                this.updateAppointmentStatus(e.target.dataset.appointmentId, e.target.value);
            });
        });
    }

    async updateAppointmentStatus(appointmentId, newStatus) {
        try {
            const { error } = await db.updateAppointment(appointmentId, { status: newStatus });
            
            if (error) throw error;
            
            // Show success message
            this.showNotification('Appointment status updated successfully', 'success');
            
        } catch (error) {
            console.error('Error updating appointment status:', error);
            this.showNotification('Failed to update appointment status', 'error');
        }
    }

    async loadServices() {
        if (!this.businessId) return;

        try {
            const { data: services, error } = await db.getServices(this.businessId);

            if (error) throw error;
            this.renderServicesTable(services);

        } catch (error) {
            console.error('Error loading services:', error);
        }
    }

    renderServicesTable(services) {
        const tbody = document.querySelector('#servicesTable tbody');
        
        if (!services || services.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No services found</td></tr>';
            return;
        }

        tbody.innerHTML = services.map(service => `
            <tr>
                <td>${service.name}</td>
                <td>${service.category}</td>
                <td>${service.duration} min</td>
                <td>$${service.price}</td>
                <td>
                    <span class="status-badge ${service.is_active ? 'status-active' : 'status-inactive'}">
                        ${service.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>
                    <button class="btn-sm" onclick="businessDashboard.editService('${service.id}')">Edit</button>
                    <button class="btn-sm btn-danger" onclick="businessDashboard.deleteService('${service.id}')">Delete</button>
                </td>
            </tr>
        `).join('');
    }

    showServiceModal(service = null) {
        const modal = document.getElementById('serviceModal');
        const title = document.getElementById('serviceModalTitle');
        const form = document.getElementById('serviceForm');

        if (service) {
            title.textContent = 'Edit Service';
            document.getElementById('serviceId').value = service.id;
            document.getElementById('serviceName').value = service.name;
            document.getElementById('serviceCategory').value = service.category;
            document.getElementById('serviceDescription').value = service.description || '';
            document.getElementById('serviceDuration').value = service.duration;
            document.getElementById('servicePrice').value = service.price;
            document.getElementById('serviceActive').checked = service.is_active;
        } else {
            title.textContent = 'Add Service';
            form.reset();
            document.getElementById('serviceId').value = '';
        }

        modal.style.display = 'block';
    }

    hideServiceModal() {
        document.getElementById('serviceModal').style.display = 'none';
    }

    async handleServiceSubmit(e) {
        e.preventDefault();

        const serviceData = {
            business_id: this.businessId,
            name: document.getElementById('serviceName').value,
            category: document.getElementById('serviceCategory').value,
            description: document.getElementById('serviceDescription').value,
            duration: parseInt(document.getElementById('serviceDuration').value),
            price: parseFloat(document.getElementById('servicePrice').value),
            is_active: document.getElementById('serviceActive').checked
        };

        const serviceId = document.getElementById('serviceId').value;

        try {
            if (serviceId) {
                // Update existing service
                const { error } = await db.updateService(serviceId, serviceData);
                if (error) throw error;
                this.showNotification('Service updated successfully', 'success');
            } else {
                // Create new service
                const { error } = await db.createService(serviceData);
                if (error) throw error;
                this.showNotification('Service created successfully', 'success');
            }

            this.hideServiceModal();
            this.loadServices();

        } catch (error) {
            console.error('Error saving service:', error);
            this.showNotification('Failed to save service', 'error');
        }
    }

    async editService(serviceId) {
        try {
            const { data: service, error } = await supabase
                .from('services')
                .select('*')
                .eq('id', serviceId)
                .single();

            if (error) throw error;
            this.showServiceModal(service);

        } catch (error) {
            console.error('Error loading service:', error);
            this.showNotification('Failed to load service', 'error');
        }
    }

    async deleteService(serviceId) {
        if (!confirm('Are you sure you want to delete this service?')) return;

        try {
            const { error } = await supabase
                .from('services')
                .delete()
                .eq('id', serviceId);

            if (error) throw error;

            this.showNotification('Service deleted successfully', 'success');
            this.loadServices();

        } catch (error) {
            console.error('Error deleting service:', error);
            this.showNotification('Failed to delete service', 'error');
        }
    }

    async loadStylists() {
        if (!this.businessId) return;

        try {
            const { data: stylists, error } = await db.getStylists(this.businessId);

            if (error) throw error;
            this.renderStylists(stylists);

        } catch (error) {
            console.error('Error loading stylists:', error);
        }
    }

    renderStylists(stylists) {
        const grid = document.getElementById('stylistsGrid');
        
        if (!stylists || stylists.length === 0) {
            grid.innerHTML = '<p style="text-align: center; grid-column: 1 / -1;">No stylists found</p>';
            return;
        }

        grid.innerHTML = stylists.map(stylist => `
            <div class="stylist-card">
                <div class="stylist-photo">
                    ${stylist.profile_picture_url ? 
                        `<img src="${stylist.profile_picture_url}" alt="${stylist.name}">` :
                        `<div class="stylist-initials">${stylist.name.split(' ').map(n => n[0]).join('')}</div>`
                    }
                </div>
                <div class="stylist-info">
                    <h3>${stylist.name}</h3>
                    <p class="stylist-specialization">${stylist.specialization || 'General Stylist'}</p>
                    <p class="stylist-contact">${stylist.email}</p>
                    <p class="stylist-contact">${stylist.phone_number}</p>
                    <div class="stylist-status ${stylist.is_available ? 'available' : 'unavailable'}">
                        ${stylist.is_available ? 'Available' : 'Unavailable'}
                    </div>
                </div>
                <div class="stylist-actions">
                    <button class="btn-sm" onclick="businessDashboard.editStylist('${stylist.id}')">Edit</button>
                    <button class="btn-sm btn-danger" onclick="businessDashboard.deleteStylist('${stylist.id}')">Delete</button>
                </div>
            </div>
        `).join('');
    }

    generateQRCode() {
        const qrContainer = document.getElementById('qrCodeContainer');
        
        if (!this.businessId) {
            qrContainer.innerHTML = '<p>Business ID not found</p>';
            return;
        }

        // Generate QR code using a simple library or API
        const qrUrl = `${window.location.origin}/pages/booking.html?business=${this.businessId}`;
        
        // Using a simple QR code generation (in production, use a proper QR library)
        qrContainer.innerHTML = `
            <div style="text-align: center;">
                <div style="background: white; padding: 20px; display: inline-block; border: 2px solid #e5e7eb;">
                    <div style="font-size: 12px; margin-bottom: 10px; color: #6b7280;">Scan to Book Appointment</div>
                    <div style="background: #000; color: white; padding: 10px; font-family: monospace; letter-spacing: 2px;">
                        SALONPRO-BOOKING
                    </div>
                    <div style="font-size: 10px; margin-top: 10px; color: #6b7280;">Business ID: ${this.businessId.slice(-8)}</div>
                </div>
            </div>
        `;

        // Store QR data for download/print
        this.currentQRData = {
            url: qrUrl,
            businessId: this.businessId,
            businessName: this.currentBusiness?.business_name
        };
    }

    downloadQRCode() {
        // In production, use a proper QR code library that supports download
        this.showNotification('QR code download feature would be implemented with a proper QR library', 'info');
    }

    printQRCode() {
        window.print();
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">&times;</button>
        `;

        // Add styles
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

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.businessDashboard = new BusinessDashboard();
});