// =============================================
// CONFIGURACIÓN Y CONSTANTES - GOOGLE CALENDAR API
// =============================================
// En google-calendar.js - reemplaza las primeras líneas
async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();
        return config;
    } catch (error) {
        console.error('Error loading config:', error);
        return {
            clientId: window.GOOGLE_CLIENT_ID || '',
            clientSecret: window.GOOGLE_CLIENT_SECRET || ''
        };
    }
}

// Luego usa await loadConfig() donde necesites las credenciales
// O usar un objeto de configuración global
const CONFIG = {
    CLIENT_ID: window.GOOGLE_CLIENT_ID || '',
    CLIENT_SECRET: window.GOOGLE_CLIENT_SECRET || '',
    API_KEY: 'AIzaSyCxa_kDBzse31dfiNpehpRwAo2hdgW0h_s',
    SCOPES: 'https://www.googleapis.com/auth/calendar',
    DISCOVERY_DOCS: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
    REDIRECT_URI: window.location.origin + '/oauth-callback.html'
};

// =============================================
// ESTADO DE LA APLICACIÓN
// =============================================
window.appState = window.appState || {
    isInitialized: false,
    isAuthenticated: false,
    googleToken: null
};

console.log('🔧 appState inicializado:', window.appState);

function ensureAppState() {
    if (!window.appState) {
        console.log('🔧 Inicializando appState global...');
        window.appState = {
            isInitialized: false,
            isAuthenticated: false,
            googleToken: null
        };
    }
    return window.appState;
}

// Llama esta función inmediatamente
ensureAppState();

// =============================================
// INICIALIZACIÓN PRINCIPAL
// =============================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando aplicación Google Calendar...');
    showStatus('info', 'Inicializando Google Calendar...');
    
    // Verificar si estamos en la página de callback
    if (window.location.pathname.includes('oauth-callback')) {
        handleOAuthCallback();
        return;
    }
    
    // Inicializar la API
    initializeGoogleCalendar();
    
    // Inicializar la interfaz
    initializeCalendarUI();
});

// =============================================
// MANEJAR CALLBACK DE REDIRECCIÓN
// =============================================
function handleOAuthCallback() {
    console.log('🔄 Procesando callback de OAuth...');
    
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    
    if (error) {
        console.error('❌ Error en autenticación:', error);
        showStatus('error', `Error de autenticación: ${error}`);
        
        // Redirigir de vuelta después de 3 segundos
        setTimeout(() => {
            window.location.href = 'admin.html';
        }, 3000);
        return;
    }
    
    if (code) {
        console.log('✅ Código de autorización recibido');
        showStatus('success', 'Autenticación exitosa! Redirigiendo...');
        
        // Guardar el código y redirigir
        localStorage.setItem('google_auth_code', code);
        
        // Redirigir a admin.html para procesar el código
        setTimeout(() => {
            window.location.href = 'admin.html';
        }, 1000);
    } else {
        console.log('⚠️ No se recibió código, redirigiendo...');
        window.location.href = 'admin.html';
    }
}

// =============================================
// MÉTODO DE REDIRECCIÓN - ÚNICO MÉTODO
// =============================================
function handleGoogleAuthRedirect() {
    if (!window.appState || typeof window.appState === 'undefined') {
        console.error('❌ appState no está inicializado');
        window.appState = {
            isInitialized: false,
            isAuthenticated: false,
            googleToken: null
        };
    }
    
    console.log('🎯 Iniciando autenticación... Estado:', window.appState);
    if (!window.appState.isInitialized) {
        showStatus('error', 'Google Calendar API no está inicializada');
        return;
    }
    
    // Construir URL de autenticación
    const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' +
        'client_id=' + encodeURIComponent(CONFIG.CLIENT_ID) +
        '&redirect_uri=' + encodeURIComponent(CONFIG.REDIRECT_URI) +
        '&response_type=code' +
        '&scope=' + encodeURIComponent(CONFIG.SCOPES) +
        '&access_type=offline' +
        '&prompt=consent' +
        '&include_granted_scopes=true';
    
    console.log('🔄 Redirigiendo a Google para autenticación...');
    console.log('URL de redirección:', CONFIG.REDIRECT_URI);
    showStatus('info', 'Redirigiendo a Google...');
    
    // Redirigir a Google
    window.location.href = authUrl;
}

// =============================================
// PROCESAR CÓDIGO DE AUTORIZACIÓN (VERSIÓN REAL)
// =============================================
async function processAuthorizationCode() {
    const code = localStorage.getItem('google_auth_code');
    
    if (!code) {
        return false;
    }
    
    console.log('🔑 Procesando código de autorización real...');
    showStatus('info', 'Intercambiando código por token de acceso...');
    
    try {
        // Intercambiar el código por un token de acceso
        const tokenResponse = await exchangeCodeForToken(code);
        
        if (tokenResponse && tokenResponse.access_token) {
            // Guardar token real
            localStorage.setItem('google_calendar_token', tokenResponse.access_token);
            localStorage.setItem('google_refresh_token', tokenResponse.refresh_token);
            localStorage.setItem('google_token_timestamp', Date.now().toString());
            localStorage.setItem('google_token_expires_in', tokenResponse.expires_in.toString());
            
            // Configurar el token para gapi
            if (gapi.client) {
                gapi.client.setToken({
                    access_token: tokenResponse.access_token,
                    expires_in: tokenResponse.expires_in,
                    token_type: tokenResponse.token_type
                });
            }
            
            window.appState.googleToken = tokenResponse.access_token;
            window.appState.isAuthenticated = true;
            await loadUserProfile();
            console.log('✅ Autenticación REAL completada exitosamente');
            showStatus('success', '¡Conectado a Google Calendar correctamente!');
            
            // Limpiar código usado
            localStorage.removeItem('google_auth_code');
            
            // Actualizar UI
            updateAuthUI(true);
            
            // Cargar eventos REALES
            setTimeout(() => {
                loadRealCalendarEvents();
            }, 1000);
            
            return true;
        } else {
            throw new Error('No se pudo obtener el token de acceso');
        }
        
    } catch (error) {
        console.error('❌ Error procesando código REAL:', error);
        showStatus('error', 'Error al completar la autenticación: ' + error.message);
        return false;
    }
}

// =============================================
// INTERCAMBIAR CÓDIGO POR TOKEN (FLUJO REAL)
// =============================================
async function exchangeCodeForToken(code) {
    console.log("🔄 Intercambiando código por token via API...");
    
    try {
        const response = await fetch('/api/auth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                code: code,
                redirect_uri: CONFIG.REDIRECT_URI
            })
        });

        console.log("📡 Response status:", response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error("❌ Error response:", errorText);
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const tokenData = await response.json();
        console.log("✅ Token exchange successful via API");
        return tokenData;
        
    } catch (error) {
        console.error('❌ Error intercambiando código por token:', error);
        
        // Fallback para desarrollo
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            showStatus('warning', 'Modo desarrollo - Usando token simulado');
            return {
                access_token: 'dev_token_' + Date.now(),
                token_type: 'Bearer',
                expires_in: 3600,
                scope: CONFIG.SCOPES,
                refresh_token: 'dev_refresh_token'
            };
        } else {
            showStatus('error', 'Error de autenticación: ' + error.message);
            throw error;
        }
    }
}

// =============================================
// INICIALIZACIÓN DE GOOGLE CALENDAR API
// =============================================
function initializeGoogleCalendar() {
    console.log('📅 Inicializando Google Calendar API...');
    
    if (typeof gapi === 'undefined') {
        console.error('❌ gapi no está disponible');
        showStatus('error', 'Error: Bibliotecas de Google no cargadas. Recarga la página.');
        return;
    }
    
    gapi.load('client', {
        callback: function() {
            initializeGapiClient();
        },
        onerror: function() {
            console.error('❌ Error cargando Google Client');
            showStatus('error', 'Error cargando bibliotecas de Google');
        },
        timeout: 15000,
        ontimeout: function() {
            console.error('❌ Timeout cargando Google Client');
            showStatus('error', 'Timeout cargando servicios de Google');
        }
    });
}

async function initializeGapiClient() {
    try {
        await gapi.client.init({
            apiKey: CONFIG.API_KEY,
            discoveryDocs: CONFIG.DISCOVERY_DOCS,
        });
        
        console.log('✅ Google Calendar API inicializada correctamente');
        showStatus('success', 'Google Calendar API lista');
        
        window.appState.isInitialized = true;
        
        // Verificar si hay un código pendiente de procesar
        const pendingCode = localStorage.getItem('google_auth_code');
        if (pendingCode) {
            console.log('🔄 Procesando código de autorización pendiente...');
            await processAuthorizationCode();
        } else {
            // Verificar si hay un token guardado
            await checkExistingToken();
        }
        
    } catch (error) {
        console.error('❌ Error inicializando Google Client:', error);
        showStatus('error', `Error: ${error.message}`);
    }
}

async function checkExistingToken() {
    const savedToken = localStorage.getItem('google_calendar_token');
    const tokenTimestamp = localStorage.getItem('google_token_timestamp');
    const expiresIn = localStorage.getItem('google_token_expires_in');
    
    if (savedToken && tokenTimestamp && expiresIn) {
        // Verificar si el token no ha expirado
        const tokenAge = Date.now() - parseInt(tokenTimestamp);
        const tokenExpires = parseInt(expiresIn) * 1000; // convertir a milisegundos
        
        if (tokenAge < tokenExpires - 60000) { // 1 minuto de margen
            console.log('🔑 Token guardado encontrado y válido');
            await handleExistingToken(savedToken);
        } else {
            console.log('🔑 Token expirado, intentando renovar...');
            await tryRefreshToken();
        }
    }
}

async function tryRefreshToken() {
    const refreshToken = localStorage.getItem('google_refresh_token');
    
    if (refreshToken) {
        try {
            const newToken = await refreshAccessToken(refreshToken);
            if (newToken) {
                await handleExistingToken(newToken.access_token);
                return;
            }
        } catch (error) {
            console.error('Error renovando token:', error);
        }
    }
    
    // Si no se puede renovar, limpiar
    console.log('🔑 Token expirado, limpiando...');
    localStorage.removeItem('google_calendar_token');
    localStorage.removeItem('google_refresh_token');
    localStorage.removeItem('google_token_timestamp');
    localStorage.removeItem('google_token_expires_in');
}

async function refreshAccessToken(refreshToken) {
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    
    const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
    });
    
    const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params
    });
    
    if (response.ok) {
        return await response.json();
    }
    return null;
}
processAuthorizationCode
async function handleExistingToken(token) {
    try {
        // Configurar el token para gapi
        gapi.client.setToken({
            access_token: token
        });
        
        window.appState.googleToken = token;
        window.appState.isAuthenticated = true;
        
        console.log('✅ Sesión restaurada con token existente');
        showStatus('success', 'Sesión de Google Calendar restaurada');
        
        updateAuthUI(true);
        
        // Cargar perfil del usuario
        await loadUserProfile();
        
        // Cargar eventos REALES
        setTimeout(() => {
            loadRealCalendarEvents();
        }, 1000);
        
    } catch (error) {
        console.error('❌ Error restaurando sesión:', error);
        handleGoogleSignOut();
    }
}

// =============================================
// CERRAR SESIÓN
// =============================================
function handleGoogleSignOut() {
    console.log('🚪 Cerrando sesión de Google Calendar...');
    
    // Limpiar estado
    window.appState.googleToken = null;
    window.appState.isAuthenticated = false;
    
    // Limpiar gapi
    if (gapi.client) {
        gapi.client.setToken(null);
    }
    
    // Limpiar localStorage
    localStorage.removeItem('google_calendar_token');
    localStorage.removeItem('google_refresh_token');
    localStorage.removeItem('google_token_timestamp');
    localStorage.removeItem('google_token_expires_in');
    localStorage.removeItem('google_auth_code');
    
    console.log('✅ Sesión de Google Calendar cerrada');
    showStatus('info', 'Sesión de Google Calendar cerrada');
    
    updateAuthUI(false);
    clearCalendarEvents();
}

// =============================================
// FUNCIONES DE CALENDAR REALES
// =============================================
async function loadRealCalendarEvents() {
    if (!window.appState.isAuthenticated) {
        showStatus('warning', 'Debes conectarte a Google Calendar primero');
        return;
    }
    
    console.log('📥 Cargando eventos REALES del calendario...');
    showStatus('info', 'Cargando eventos del calendario...');
    
    try {
        const response = await gapi.client.calendar.events.list({
            'calendarId': 'primary',
            'timeMin': (new Date()).toISOString(),
            'showDeleted': false,
            'singleEvents': true,
            'maxResults': 10,
            'orderBy': 'startTime'
        });
        
        const events = response.result.items;
        console.log('✅ Eventos REALES cargados:', events.length);
        
        if (events.length > 0) {
            displayCalendarEvents(events);
            showStatus('success', `${events.length} eventos cargados correctamente`);
        } else {
            displayNoEvents();
            showStatus('info', 'No hay eventos próximos en el calendario');
        }
        
    } catch (error) {
        console.error('❌ Error cargando eventos REALES:', error);
        
        // Fallback a eventos simulados si hay error de autenticación
        if (error.status === 401) {
            showStatus('warning', 'Token inválido. Usando modo simulación.');
            loadCalendarEventsSimulated();
        } else {
            showStatus('error', 'Error al cargar eventos del calendario: ' + error.message);
        }
    }
}

function loadCalendarEventsSimulated() {
    console.log('🔧 Cargando eventos simulados...');
    
    const mockEvents = [
        {
            summary: 'Consulta Médica - Juan Pérez',
            start: { dateTime: new Date(Date.now() + 86400000).toISOString() },
            end: { dateTime: new Date(Date.now() + 90000000).toISOString() },
            description: 'Consulta de rutina'
        },
        {
            summary: 'Control Mensual - María García',
            start: { dateTime: new Date(Date.now() + 172800000).toISOString() },
            end: { dateTime: new Date(Date.now() + 176400000).toISOString() },
            description: 'Control mensual de paciente'
        }
    ];
    
    console.log('✅ Eventos cargados (simulados):', mockEvents.length);
    
    if (mockEvents.length > 0) {
        displayCalendarEvents(mockEvents);
        showStatus('info', `${mockEvents.length} eventos de ejemplo cargados`);
    } else {
        displayNoEvents();
        showStatus('info', 'No hay eventos próximos');
    }
}

// =============================================
// SINCRONIZACIÓN CON GOOGLE CALENDAR (VERSIÓN REAL)
// =============================================
async function syncAllTurnsToCalendar() {
    // AGREGAR ESTA VERIFICACIÓN MEJORADA:
    if (!window.appState || typeof window.appState === 'undefined') {
        console.error('❌ appState no está inicializado, reinicializando...');
        window.appState = {
            isInitialized: false,
            isAuthenticated: false,
            googleToken: null
        };
    }
    
    if (!window.appState.isAuthenticated) {
        showStatus('error', 'Debes conectarte a Google Calendar primero');
        return;
    }
    console.log('🔄 Sincronizando turnos con Google Calendar...');
    showStatus('info', 'Sincronizando turnos con Google Calendar...');

    try {
        // Obtener turnos de Firebase
        const turns = await getTurnsFromFirebase();
        
        if (!turns || turns.length === 0) {
            showStatus('info', 'No hay turnos para sincronizar');
            return;
        }

        let createdCount = 0;
        let errorCount = 0;

        // Crear eventos para cada turno
        for (const turn of turns) {
            try {
                const eventCreated = await createRealCalendarEventFromTurn(turn);
                if (eventCreated) {
                    createdCount++;
                } else {
                    errorCount++;
                }
                
                // Pequeña pausa para no exceder límites de la API
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error(`Error creando evento para turno ${turn.id}:`, error);
                errorCount++;
            }
        }

        const message = `Sincronización completada: ${createdCount} eventos creados, ${errorCount} errores`;
        console.log('✅ ' + message);
        showStatus('success', message);
        
        // Recargar eventos para mostrar los nuevos
        setTimeout(() => {
            loadRealCalendarEvents();
        }, 2000);

    } catch (error) {
        console.error('❌ Error en sincronización:', error);
        showStatus('error', 'Error al sincronizar turnos con Google Calendar: ' + error.message);
    }
}

async function createRealCalendarEventFromTurn(turn) {
    try {
        // Verificar si el evento ya existe (para evitar duplicados)
        const existingEvent = await checkRealExistingEvent(turn);
        if (existingEvent) {
            console.log(`⚠️ Evento ya existe para turno ${turn.id}`);
            return true;
        }

        // VALIDAR Y FORMATEAR FECHA Y HORA CORRECTAMENTE
        const startDateTime = formatDateTimeForCalendar(turn.fecha, turn.hora);
        if (!startDateTime) {
            console.error('❌ Fecha/hora inválida para el turno:', turn);
            return false;
        }

        const endDateTime = new Date(startDateTime.getTime() + (20 * 60 * 1000)); // 20 minutos

        // VALIDAR QUE LAS FECHAS SEAN VÁLIDAS
        if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
            console.error('❌ Fechas inválidas después del formateo:', { start: startDateTime, end: endDateTime });
            return false;
        }

        const event = {
            summary: `📅 ${turn.servicio} - ${turn.pacienteNombre} ${turn.pacienteApellido}`,
            description: `
Paciente: ${turn.pacienteNombre} ${turn.pacienteApellido}
DNI: ${turn.pacienteDNI}
Servicio: ${turn.servicio}
Estado: ${turn.estado}
Teléfono: ${turn.pacienteTelefono || 'No proporcionado'}
Email: ${turn.pacienteEmail || 'No proporcionado'}

Turno creado a través del sistema del Consultorio Dra. Monelli
            `.trim(),
            start: {
                dateTime: startDateTime.toISOString(),
                timeZone: 'America/Argentina/Buenos_Aires'
            },
            end: {
                dateTime: endDateTime.toISOString(),
                timeZone: 'America/Argentina/Buenos_Aires'
            },
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'email', minutes: 24 * 60 },
                    { method: 'popup', minutes: 60 }
                ]
            }
        };

        const response = await gapi.client.calendar.events.insert({
            calendarId: 'primary',
            resource: event
        });

        console.log('✅ Evento REAL creado (20min):', response.result.htmlLink);
        
        // Guardar el ID del evento en Firebase
        await saveEventIdToTurn(turn.id, response.result.id);
        
        return true;

    } catch (error) {
        console.error('❌ Error creando evento REAL:', error);
        
        if (error.status === 401) {
            showStatus('error', 'Token expirado. Por favor, reconecta a Google Calendar.');
            handleGoogleSignOut();
        }
        
        return false;
    }
}

async function checkRealExistingEvent(turn) {
    try {
        const startDateTime = formatDateTimeForCalendar(turn.fecha, turn.hora);
        if (!startDateTime || isNaN(startDateTime.getTime())) {
            console.error('❌ Fecha/hora inválida para verificación:', turn);
            return false;
        }

        const endDateTime = new Date(startDateTime.getTime() + (20 * 60 * 1000)); // 20 minutos

        const response = await gapi.client.calendar.events.list({
            calendarId: 'primary',
            timeMin: startDateTime.toISOString(),
            timeMax: endDateTime.toISOString(),
            singleEvents: true,
            q: turn.pacienteDNI
        });

        return response.result.items.length > 0;
    } catch (error) {
        console.error('Error verificando evento existente:', error);
        return false;
    }
}

// NUEVA FUNCIÓN: Formatear fecha y hora de manera segura
function formatDateTimeForCalendar(fecha, hora) {
    try {
        // Validar que los parámetros existan
        if (!fecha || !hora) {
            console.error('❌ Fecha o hora vacías:', { fecha, hora });
            return null;
        }

        // Limpiar y validar formato de fecha (YYYY-MM-DD)
        const fechaParts = fecha.split('-');
        if (fechaParts.length !== 3) {
            console.error('❌ Formato de fecha inválido:', fecha);
            return null;
        }

        const year = parseInt(fechaParts[0]);
        const month = parseInt(fechaParts[1]) - 1; // Meses en Date son 0-11
        const day = parseInt(fechaParts[2]);

        // Validar fecha
        if (isNaN(year) || isNaN(month) || isNaN(day)) {
            console.error('❌ Fecha contiene valores no numéricos:', fecha);
            return null;
        }

        // Limpiar y validar formato de hora (HH:MM)
        const horaParts = hora.split(':');
        if (horaParts.length !== 2) {
            console.error('❌ Formato de hora inválido:', hora);
            return null;
        }

        const hours = parseInt(horaParts[0]);
        const minutes = parseInt(horaParts[1]);

        // Validar hora
        if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
            console.error('❌ Hora inválida:', hora);
            return null;
        }

        // Crear objeto Date con validación
        const dateTime = new Date(year, month, day, hours, minutes);
        
        // Verificar que la fecha sea válida
        if (isNaN(dateTime.getTime())) {
            console.error('❌ Fecha/hora resultante inválida:', { fecha, hora, dateTime });
            return null;
        }

        // Verificar que los componentes coincidan (para detectar fechas como 2024-02-30)
        if (dateTime.getFullYear() !== year || 
            dateTime.getMonth() !== month || 
            dateTime.getDate() !== day) {
            console.error('❌ Fecha inconsistente después del parseo:', { 
                original: `${year}-${month+1}-${day}`, 
                parsed: `${dateTime.getFullYear()}-${dateTime.getMonth()+1}-${dateTime.getDate()}` 
            });
            return null;
        }

        return dateTime;

    } catch (error) {
        console.error('❌ Error en formatDateTimeForCalendar:', error, { fecha, hora });
        return null;
    }
}

// =============================================
// FUNCIONES DE FIRESTORE
// =============================================

/**
 * Obtiene turnos de Firebase
 */
async function getTurnsFromFirebase() {
    return new Promise((resolve, reject) => {
        if (typeof db === 'undefined') {
            reject(new Error('Firebase no está inicializado'));
            return;
        }

        db.collection('turnos')
            .where('estado', 'in', ['confirmado', 'completado'])
            .get()
            .then((snapshot) => {
                const turns = [];
                snapshot.forEach(doc => {
                    turns.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                resolve(turns);
            })
            .catch(reject);
    });
}

/**
 * Guarda el ID del evento de Google Calendar en Firebase
 */
async function saveEventIdToTurn(turnId, eventId) {
    try {
        await db.collection('turnos').doc(turnId).update({
            googleCalendarEventId: eventId,
            lastSynced: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error guardando ID del evento:', error);
    }
}

/**
 * Sincroniza un solo turno (para usar cuando se crea un nuevo turno)
 */
async function syncSingleTurnToCalendar(turnId) {
    if (!window.appState.isAuthenticated) {
        console.log('Google Calendar no conectado, omitiendo sincronización');
        return;
    }

    try {
        const turnDoc = await db.collection('turnos').doc(turnId).get();
        if (turnDoc.exists) {
            const turn = {
                id: turnDoc.id,
                ...turnDoc.data()
            };
            
            await createRealCalendarEventFromTurn(turn);
            console.log('✅ Turno sincronizado con Google Calendar');
        }
    } catch (error) {
        console.error('Error sincronizando turno individual:', error);
    }
}

// =============================================
// SINCRONIZACIÓN AUTOMÁTICA
// =============================================

/**
 * Configura el listener para sincronización automática
 */
function setupTurnListener() {
    if (typeof db === 'undefined') {
        showStatus('error', 'Firebase no está inicializado');
        return;
    }

    // Escuchar nuevos turnos
    db.collection('turnos')
        .where('estado', '==', 'confirmado')
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    console.log('🆕 Nuevo turno detectado:', change.doc.id);
                    // Sincronizar después de un pequeño delay
                    setTimeout(() => {
                        syncSingleTurnToCalendar(change.doc.id);
                    }, 2000);
                }
            });
        });

    showStatus('success', 'Sincronización automática activada. Los nuevos turnos se agregarán a Google Calendar.');
}

/**
 * Actualiza un evento existente cuando cambia el estado del turno
 */
async function updateCalendarEvent(turnId, newStatus) {
    if (!window.appState.isAuthenticated) return;

    try {
        const turnDoc = await db.collection('turnos').doc(turnId).get();
        if (!turnDoc.exists) return;

        const turn = turnDoc.data();
        const eventId = turn.googleCalendarEventId;

        if (!eventId) return;

        const event = await gapi.client.calendar.events.get({
            calendarId: 'primary',
            eventId: eventId
        });

        // Actualizar el evento con el nuevo estado
        const updatedEvent = {
            ...event.result,
            summary: `📅 ${turn.servicio} - ${turn.pacienteNombre} ${turn.pacienteApellido} (${newStatus})`,
            description: event.result.description.replace(
                `Estado: ${turn.estado}`,
                `Estado: ${newStatus}`
            )
        };

        await gapi.client.calendar.events.update({
            calendarId: 'primary',
            eventId: eventId,
            resource: updatedEvent
        });

        console.log('✅ Evento actualizado en Google Calendar');
    } catch (error) {
        console.error('Error actualizando evento:', error);
    }
}

// =============================================
// INTERFAZ DE USUARIO
// =============================================
function initializeCalendarUI() {
    console.log('🔧 Inicializando interfaz de Google Calendar...');
    
    // Esperar a que el DOM esté completamente listo
    setTimeout(() => {
        const authBtn = document.getElementById('google-auth-btn');
        const redirectBtn = document.getElementById('connectRedirectBtn');
        
        if (authBtn) {
            console.log('✅ Botón de Google Calendar encontrado');
            
            authBtn.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('🖱️ Botón Conectar clickeado - usando redirección');
                handleGoogleAuthRedirect();
            });
        }
        
        if (redirectBtn) {
            console.log('✅ Botón de redirección encontrado');
            
            redirectBtn.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('🖱️ Botón redirección clickeado');
                handleGoogleAuthRedirect();
            });
        }
        
        // Actualizar UI inicial
        updateAuthUI(window.appState.isAuthenticated);
        
    }, 500);
}

function updateAuthUI(isSignedIn) {
    const authBtn = document.getElementById('google-auth-btn');
    const authStatus = document.getElementById('google-auth-status');
    
    if (authBtn && authStatus) {
        if (isSignedIn) {
            // Botón muestra info del usuario conectado
            authBtn.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <img id="user-avatar" src="" alt="Avatar" style="width: 24px; height: 24px; border-radius: 50%;">
                    <span id="user-name">Cargando...</span>
                    <i class="fas fa-sign-out-alt"></i>
                </div>
            `;
            authBtn.className = 'btn btn-outline-secondary';
            authBtn.onclick = handleGoogleSignOut;
            
            authStatus.innerHTML = `
                <div style="color: var(--secondary); margin-top: 5px; font-size: 0.9rem;">
                    <i class="fas fa-check-circle"></i> Conectado a Google Calendar
                </div>
            `;
            
            // Cargar información del usuario
            loadUserProfile();
            
        } else {
            // Botón para conectar
            authBtn.innerHTML = '<i class="fab fa-google"></i> Conectar Google Calendar';
            authBtn.className = 'btn btn-success';
            authBtn.onclick = handleGoogleAuthRedirect;
            
            authStatus.innerHTML = `
                <div style="color: var(--gray); margin-top: 5px; font-size: 0.9rem;">
                    <i class="fas fa-info-circle"></i> No conectado a Google Calendar
                </div>
            `;
        }
        
        console.log('🔄 UI actualizada:', { isSignedIn });
    }
}

// =============================================
// FUNCIONES DE CALENDAR (VISUALIZACIÓN)
// =============================================
function displayCalendarEvents(events) {
    const eventsContainer = document.getElementById('calendar-events-container');
    
    if (!eventsContainer) {
        console.log('ℹ️ No se encontró contenedor de eventos en esta página');
        return;
    }
    
    let eventsHTML = `
        <h3 style="color: var(--primary); margin-bottom: 15px;">
            <i class="fas fa-calendar-alt"></i> Próximos Eventos (${events.length})
        </h3>
        <div style="font-size: 14px; color: var(--gray); margin-bottom: 20px;">
            Mostrando eventos de Google Calendar
        </div>
        <div class="events-list">
    `;
    
    events.forEach(function(event) {
        const eventDate = formatEventDate(event.start);
        const eventTime = formatEventTime(event.start, event.end);
        
        eventsHTML += `
            <div class="calendar-event" style="
                background: var(--white);
                border-left: 4px solid var(--primary);
                padding: 15px;
                margin-bottom: 10px;
                border-radius: 5px;
                box-shadow: var(--shadow);
            ">
                <div class="event-title" style="
                    font-weight: 600;
                    color: var(--dark);
                    margin-bottom: 8px;
                    font-size: 1.1rem;
                ">${event.summary || 'Evento sin título'}</div>
                <div class="event-details" style="font-size: 0.9rem; color: var(--gray);">
                    <div><strong>📅 Fecha:</strong> ${eventDate}</div>
                    <div><strong>⏰ Horario:</strong> ${eventTime}</div>
                    ${event.description ? `<div><strong>📝 Descripción:</strong> ${event.description}</div>` : ''}
                </div>
            </div>
        `;
    });
    
    eventsHTML += '</div>';
    eventsContainer.innerHTML = eventsHTML;
}

function displayNoEvents() {
    const eventsContainer = document.getElementById('calendar-events-container');
    if (!eventsContainer) return;
    
    eventsContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--gray);">
            <div style="font-size: 48px; margin-bottom: 20px;">📅</div>
            <h3>No hay eventos próximos</h3>
            <p>No se encontraron eventos futuros en tu calendario principal.</p>
        </div>
    `;
}

function clearCalendarEvents() {
    const eventsContainer = document.getElementById('calendar-events-container');
    if (eventsContainer) {
        eventsContainer.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--gray);">
                <i class="fas fa-calendar-times"></i> No conectado a Google Calendar
            </div>
        `;
    }
}

// =============================================
// FUNCIONES DE UTILIDAD
// =============================================
function formatEventDate(start) {
    if (start.dateTime) {
        return new Date(start.dateTime).toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } else {
        return new Date(start.date).toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
}

function formatEventTime(start, end) {
    if (start.dateTime) {
        const startTime = new Date(start.dateTime).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
        });
        const endTime = new Date(end.dateTime).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
        });
        return `${startTime} - ${endTime}`;
    } else {
        return 'Todo el día';
    }
}

function showStatus(type, message) {
    console.log(`📢 [${type.toUpperCase()}] ${message}`);
    
    let statusContainer = document.getElementById('statusMessages');
    if (!statusContainer) return;
    
    const statusId = 'status-' + Date.now();
    const statusElement = document.createElement('div');
    statusElement.id = statusId;
    statusElement.style.cssText = `
        padding: 12px 16px;
        margin-bottom: 8px;
        border-radius: 6px;
        font-size: 14px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        transition: all 0.3s ease;
        border-left: 4px solid;
        cursor: pointer;
    `;
    
    switch(type) {
        case 'success':
            statusElement.style.backgroundColor = '#d4edda';
            statusElement.style.color = '#155724';
            statusElement.style.borderLeftColor = '#28a745';
            break;
        case 'error':
            statusElement.style.backgroundColor = '#f8d7da';
            statusElement.style.color = '#721c24';
            statusElement.style.borderLeftColor = '#dc3545';
            break;
        case 'info':
            statusElement.style.backgroundColor = '#d1ecf1';
            statusElement.style.color = '#0c5460';
            statusElement.style.borderLeftColor = '#17a2b8';
            break;
        case 'warning':
            statusElement.style.backgroundColor = '#fff3cd';
            statusElement.style.color = '#856404';
            statusElement.style.borderLeftColor = '#ffc107';
            break;
        default:
            statusElement.style.backgroundColor = '#e2e3e5';
            statusElement.style.color = '#383d41';
            statusElement.style.borderLeftColor = '#6c757d';
    }
    
    statusElement.innerHTML = `[${getCurrentTime()}] ${message}`;
    statusContainer.appendChild(statusElement);
    
    statusElement.addEventListener('click', function() {
        this.remove();
    });
    
    setTimeout(() => {
        const element = document.getElementById(statusId);
        if (element) element.remove();
    }, 5000);
}

function getCurrentTime() {
    return new Date().toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

// =============================================
// ELIMINAR EVENTO DE GOOGLE CALENDAR
// =============================================

/**
 * Elimina un evento de Google Calendar cuando se cancela un turno
 */
async function deleteCalendarEvent(turnId) {
    if (!window.appState.isAuthenticated) {
        console.log('Google Calendar no conectado, no se puede eliminar evento');
        return false;
    }

    try {
        // Obtener el turno de Firebase para conseguir el eventId
        const turnDoc = await db.collection('turnos').doc(turnId).get();
        if (!turnDoc.exists) {
            console.log('Turno no encontrado:', turnId);
            return false;
        }

        const turn = turnDoc.data();
        const eventId = turn.googleCalendarEventId;

        if (!eventId) {
            console.log('No hay eventId asociado al turno:', turnId);
            return false;
        }

        // Eliminar el evento de Google Calendar
        await gapi.client.calendar.events.delete({
            calendarId: 'primary',
            eventId: eventId
        });

        console.log('✅ Evento eliminado de Google Calendar:', eventId);
        
        // Limpiar el eventId del turno en Firebase
        await db.collection('turnos').doc(turnId).update({
            googleCalendarEventId: null,
            lastSynced: new Date().toISOString()
        });

        showStatus('success', 'Evento eliminado de Google Calendar');
        return true;

    } catch (error) {
        console.error('❌ Error eliminando evento de Google Calendar:', error);
        
        if (error.status === 404) {
            console.log('Evento no encontrado en Google Calendar, puede que ya haya sido eliminado');
            // Limpiar el eventId de todas formas
            try {
                await db.collection('turnos').doc(turnId).update({
                    googleCalendarEventId: null,
                    lastSynced: new Date().toISOString()
                });
            } catch (dbError) {
                console.error('Error limpiando eventId:', dbError);
            }
            return true;
        }
        
        showStatus('error', 'Error al eliminar evento de Google Calendar');
        return false;
    }
}

/**
 * Elimina eventos de Google Calendar para turnos cancelados
 */
async function cleanupCanceledTurns() {
    if (!window.appState.isAuthenticated) {
        return;
    }

    try {
        console.log('🧹 Limpiando eventos de turnos cancelados...');
        
        // Obtener turnos cancelados que tengan eventId
        const canceledTurns = await getCanceledTurnsWithEvents();
        
        if (canceledTurns.length === 0) {
            console.log('No hay turnos cancelados con eventos para limpiar');
            return;
        }

        let deletedCount = 0;
        let errorCount = 0;

        for (const turn of canceledTurns) {
            try {
                const success = await deleteCalendarEvent(turn.id);
                if (success) {
                    deletedCount++;
                } else {
                    errorCount++;
                }
                
                // Pequeña pausa para no exceder límites de la API
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (error) {
                console.error(`Error eliminando evento para turno ${turn.id}:`, error);
                errorCount++;
            }
        }

        console.log(`✅ Limpieza completada: ${deletedCount} eventos eliminados, ${errorCount} errores`);
        
        if (deletedCount > 0) {
            showStatus('success', `Limpieza completada: ${deletedCount} eventos eliminados`);
        }

    } catch (error) {
        console.error('❌ Error en limpieza de eventos:', error);
        
        // Manejar específicamente el error de índice faltante
        if (error.message && error.message.includes('index')) {
            console.warn('Índice de Firebase faltante. La limpieza automática se reanudará cuando el índice esté disponible.');
            showStatus('warning', 'Configuración de base de datos en progreso...');
        }
    }
}

/**
 * Obtiene turnos cancelados que tienen eventos en Google Calendar
 */
async function getCanceledTurnsWithEvents() {
    return new Promise((resolve, reject) => {
        if (typeof db === 'undefined') {
            reject(new Error('Firebase no está inicializado'));
            return;
        }

        db.collection('turnos')
            .where('estado', '==', 'cancelado')
            .where('googleCalendarEventId', '!=', null)
            .get()
            .then((snapshot) => {
                const turns = [];
                snapshot.forEach(doc => {
                    const turnData = doc.data();
                    if (turnData.googleCalendarEventId) {
                        turns.push({
                            id: doc.id,
                            ...turnData
                        });
                    }
                });
                resolve(turns);
            })
            .catch(reject);
    });
}
    
// =============================================
// CARGAR PERFIL DEL USUARIO
// =============================================
async function loadUserProfile() {
    if (!window.appState.isAuthenticated || !window.appState.googleToken) {
        return;
    }
    
    try {
        console.log('👤 Cargando perfil del usuario...');
        
        const response = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
            headers: {
                'Authorization': `Bearer ${window.appState.googleToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const userInfo = await response.json();
        console.log('✅ Perfil cargado:', userInfo);
        
        // Actualizar el botón con la información del usuario
        updateUserButton(userInfo);
        
    } catch (error) {
        console.error('❌ Error cargando perfil:', error);
        // Fallback: mostrar información básica
        updateUserButton({ name: 'Usuario', picture: '' });
    }
}

function updateUserButton(userInfo) {
    const authBtn = document.getElementById('google-auth-btn');
    if (!authBtn) return;
    
    const userName = userInfo.name || 'Usuario';
    const userEmail = userInfo.email || '';
    const userPicture = userInfo.picture || '';
    
    authBtn.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
            ${userPicture ? 
                `<img src="${userPicture}" alt="${userName}" style="width: 24px; height: 24px; border-radius: 50%; border: 1px solid #ddd;">` : 
                `<div style="width: 24px; height: 24px; border-radius: 50%; background: var(--primary); display: flex; align-items: center; justify-content: center; color: white; font-size: 12px;">${userName.charAt(0).toUpperCase()}</div>`
            }
            <div style="text-align: left;">
                <div style="font-size: 0.9rem; font-weight: 500;">${userName}</div>
                ${userEmail ? `<div style="font-size: 0.7rem; opacity: 0.8;">${userEmail}</div>` : ''}
            </div>
            <i class="fas fa-sign-out-alt" style="margin-left: 8px;"></i>
        </div>
    `;
    
    // Tooltip para mostrar más información
    authBtn.title = `Conectado como ${userName}${userEmail ? ` (${userEmail})` : ''}`;
}

// =============================================
// EXPORTAR FUNCIONES
// =============================================
window.handleGoogleAuthRedirect = handleGoogleAuthRedirect;
window.handleGoogleSignOut = handleGoogleSignOut;
window.loadCalendarEvents = loadRealCalendarEvents;
window.syncAllTurnsToCalendar = syncAllTurnsToCalendar;
window.setupTurnListener = setupTurnListener;
window.syncSingleTurnToCalendar = syncSingleTurnToCalendar;
window.updateCalendarEvent = updateCalendarEvent;
window.deleteCalendarEvent = deleteCalendarEvent;
window.cleanupCanceledTurns = cleanupCanceledTurns;

console.log('✅ Google Calendar API configurada correctamente');