// ==================================================
// Salrayworks Vcam - COMPLETE preload.js
// ==================================================

const { contextBridge, ipcRenderer } = require('electron');

/**
 * The vadaAPI is the secure bridge between the Switcher UI and the System.
 * It exposes only the necessary functions to the window object.
 */
contextBridge.exposeInMainWorld('vadaAPI', {
    
    // --- 1. MEDIA & FILE SYSTEM ---
    // This triggers the Windows/Mac File Dialog and returns the selected path
    openMediaFile: () => ipcRenderer.invoke('dialog:openFile'),

    // --- 2. SWITCHER COMMANDS (UI -> ELECTRON) ---
    // Sends the TAKE command for Program/Preview transitions
    sendTake: (data) => ipcRenderer.send('vada:take', data),
    
    // Requests a specific NDI/Stream source
    startStream: (sourceName) => ipcRenderer.send('vada:start-stream', sourceName),
    
    // Requests a hardware capture card input (DeckLink/Magewell)
    startHardwareInput: (id) => ipcRenderer.send('vada:start-hardware', id),
    
    // Requests a Desktop/Window capture source
    startScreenCapture: (id) => ipcRenderer.send('vada:start-screen', id),

    // --- 3. WebRTC SIGNALING ---
    // Sends the local SDP Offer to the Electron backend
    sendOffer: (offer) => ipcRenderer.send('vada:webrtc-offer', offer),
    
    // Sends ICE Candidates for NAT traversal
    sendCandidate: (candidate) => ipcRenderer.send('vada:webrtc-candidate', candidate),

    // --- 4. DATA LISTENERS (ELECTRON -> UI) ---
    // Listens for live NDI source updates from the network
    onNDIUpdate: (callback) => {
        // Clean up existing listeners to prevent memory leaks during UI reloads
        ipcRenderer.removeAllListeners('vada:ndi-list');
        ipcRenderer.on('vada:ndi-list', (event, sources) => callback(sources));
    },

    // Listens for the WebRTC Answer from the backend to complete the handshake
    onWebRTCAnswer: (callback) => {
        ipcRenderer.removeAllListeners('vada:webrtc-answer');
        ipcRenderer.on('vada:webrtc-answer', (event, answer) => callback(answer));
    }
});

console.log("🔗 Salrayworks Bridge: Preload script injected successfully.");