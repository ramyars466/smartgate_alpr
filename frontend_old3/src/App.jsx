import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Monitor, Ticket, Car, FileText, BarChart2, Settings, ChevronLeft, 
  ChevronDown, Volume2, ShieldAlert, Video, Upload, Circle, Zap, 
  Lock, Unlock, Cpu, Shield, AlertTriangle
} from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000/api/v1';
const WS_URL = 'ws://127.0.0.1:8000/api/v1/ws/live-feed';

function App() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [wsStatus, setWsStatus] = useState('Disconnected');
  const [wsPing, setWsPing] = useState(0);
  const [liveFrame, setLiveFrame] = useState(null);
  const [lastDetection, setLastDetection] = useState(null);
  const [logs, setLogs] = useState([]);
  const [gateStatus, setGateStatus] = useState('CLOSED');
  const [inputType, setInputType] = useState('rtsp'); // 'rtsp' or 'manual'
  
  const fileInputRef = useRef(null);

  // Time ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch logs periodically
  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await axios.get(`${API_BASE}/logs`);
      setLogs(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // Websocket connection
  useEffect(() => {
    let ws;
    if (inputType === 'rtsp') {
      const connectWs = () => {
        setWsStatus('Connecting...');
        const startTime = Date.now();
        ws = new WebSocket(WS_URL);
        
        ws.onopen = () => {
          setWsStatus('Connected');
          setWsPing(Date.now() - startTime);
        };
        
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.frame) setLiveFrame(`data:image/jpeg;base64,${data.frame}`);
          if (data.plate_text) {
            setLastDetection(data);
            if (data.status === "Access Granted") {
              triggerGateAnimation();
            }
          }
        };
        
        ws.onclose = () => {
          setWsStatus('Disconnected');
          setTimeout(connectWs, 5000); // Reconnect logic
        };
      };
      connectWs();
    }
    
    return () => {
      if (ws) ws.close();
    };
  }, [inputType]);

  const triggerGateAnimation = () => {
    setGateStatus('OPEN');
    setTimeout(() => setGateStatus('CLOSED'), 5000);
  };

  const handleManualOverride = async () => {
    try {
      await axios.post(`${API_BASE}/override`);
      triggerGateAnimation();
      fetchLogs();
    } catch (err) {
      alert("Override failed");
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post(`${API_BASE}/scan-plate`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const data = res.data;
      setLastDetection(data);
      if (data.access_status === "Access Granted" || data.status === "Access Granted") {
        triggerGateAnimation();
      }
      fetchLogs();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex h-screen bg-[#0b101a] text-slate-300 font-sans overflow-hidden selection:bg-blue-500/30">
      
      {/* SIDEBAR */}
      <aside className="w-[260px] bg-[#0f1522] border-r border-[#1e293b] flex flex-col flex-shrink-0 z-20">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)]">
            <Monitor className="text-white" size={18} />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight tracking-tight">SmartGate</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">ALPR • v2.4</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-1">
          <SidebarItem icon={<Monitor size={18}/>} label="Live Gate Monitor" active />
          <SidebarItem icon={<Ticket size={18}/>} label="Visitor Passes" />
          <SidebarItem icon={<Car size={18}/>} label="Vehicle Directory" />
          <SidebarItem icon={<FileText size={18}/>} label="Audit Logs" />
          <SidebarItem icon={<BarChart2 size={18}/>} label="Analytics" />
          <SidebarItem icon={<Settings size={18}/>} label="System Config" />
        </nav>

        <div className="p-4 border-t border-[#1e293b]">
          <button className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors text-sm px-4 py-2 w-full rounded-md hover:bg-[#1e293b]/50">
            <ChevronLeft size={16} /> Collapse
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* TOP HEADER */}
        <header className="h-[60px] border-b border-[#1e293b] bg-[#0f1522]/50 backdrop-blur-md flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-6">
            <div className="font-mono text-sm font-medium text-white flex items-center gap-2">
              {currentTime.toLocaleTimeString('en-US', { hour12: false })} <span className="text-slate-500 text-xs">IST</span>
            </div>
            
            <div className="h-4 w-px bg-[#1e293b]"></div>
            
            <button className="flex items-center gap-2 text-sm bg-transparent border border-[#1e293b] hover:border-slate-600 rounded-md px-3 py-1.5 transition-colors text-slate-300">
              Main Gate - Entry <ChevronDown size={14} className="text-slate-500" />
            </button>
            
            <div className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border ${wsStatus === 'Connected' ? 'bg-[#0f291e] border-[#134e32] text-[#34d399]' : 'bg-slate-800/50 border-slate-700 text-slate-400'}`}>
              <div className={`w-2 h-2 rounded-full ${wsStatus === 'Connected' ? 'bg-[#34d399]' : 'bg-slate-500'}`}></div>
              WebSocket: {wsStatus} <span className="opacity-50 font-mono text-[10px]">({wsPing} ms)</span>
            </div>
            
            <div className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border bg-slate-900/50 border-[#1e293b] text-slate-500">
              Live Engine
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 text-sm border border-[#1e293b] hover:border-slate-600 hover:bg-[#1e293b]/30 rounded-md px-4 py-1.5 transition-colors text-slate-300">
              <Volume2 size={16} /> Audio on
            </button>
            <button onClick={handleManualOverride} className="flex items-center gap-2 text-sm bg-[#ef4444] hover:bg-[#dc2626] text-white font-medium rounded-md px-4 py-1.5 transition-colors shadow-[0_0_15px_rgba(239,68,68,0.3)]">
              <ShieldAlert size={16} /> Emergency Override
            </button>
          </div>
        </header>

        {/* DASHBOARD AREA */}
        <main className="flex-1 overflow-y-auto p-8 bg-[#0b101a]">
          
          {/* PAGE TITLE */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-1 tracking-tight">Live Gate Monitor & Scanner</h2>
            <p className="text-sm text-slate-400">Real-time ALPR pipeline • YOLOv8 detection + OCR</p>
          </div>

          {/* 2-COLUMN GRID */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6">
            
            {/* LEFT COLUMN */}
            <div className="space-y-6 flex flex-col">
              
              {/* SCANNING INPUT PANEL */}
              <div className="bg-[#131b2c] border border-[#1e293b] rounded-xl flex flex-col flex-1 shadow-lg overflow-hidden">
                <div className="p-4 border-b border-[#1e293b] flex items-center justify-between bg-[#0f1522]/50">
                  <h3 className="text-xs font-bold text-slate-500 tracking-widest uppercase flex items-center gap-2">
                    <Monitor size={14} /> Scanning Input
                  </h3>
                  <div className="flex bg-[#0b101a] border border-[#1e293b] rounded-lg p-1">
                    <button onClick={() => setInputType('rtsp')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${inputType === 'rtsp' ? 'bg-[#3b82f6] text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
                      <Video size={14} /> Live RTSP Video Stream
                    </button>
                    <button onClick={() => { setInputType('manual'); fileInputRef.current.click(); }} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${inputType === 'manual' ? 'bg-[#3b82f6] text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
                      <Upload size={14} /> Manual File Upload
                    </button>
                    <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                  </div>
                </div>
                
                {/* VIDEO AREA */}
                <div className="bg-black relative min-h-[450px] flex items-center justify-center flex-1">
                  {liveFrame ? (
                    <img src={liveFrame} className="w-full h-full object-contain opacity-90" alt="Camera feed" />
                  ) : (
                    <div className="text-slate-600 flex flex-col items-center gap-4">
                      <CameraOutline />
                      <p className="text-sm font-mono uppercase tracking-widest">Awaiting Video Stream...</p>
                    </div>
                  )}

                  {/* OVERLAYS */}
                  <div className="absolute top-4 left-4 flex items-center gap-2 text-xs font-mono font-bold text-white bg-black/50 px-2 py-1 rounded">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                    REC • CAM-01 • 25 FPS
                  </div>
                  <div className="absolute bottom-4 left-4 text-[10px] font-mono text-white/50 bg-black/50 px-2 py-1 rounded">
                    rtsp://192.168.1.100:554/stream1
                  </div>
                  
                  {/* Scanline Effect */}
                  {inputType === 'rtsp' && <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] z-10 opacity-30"></div>}
                  {inputType === 'rtsp' && <div className="absolute top-0 left-0 w-full h-1 bg-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.8)] animate-[scan_3s_infinite_linear] z-20"></div>}
                </div>
                
                {/* BOTTOM ACTION BAR */}
                <div className="p-4 border-t border-[#1e293b] bg-[#0f1522]/50 flex items-center gap-3">
                  <button onClick={() => setInputType('rtsp')} className="bg-[#0ea5e9] hover:bg-[#0284c7] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                    <Zap size={16} /> Capture & Scan Frame
                  </button>
                  <button className="bg-transparent border border-[#1e293b] hover:bg-[#1e293b] text-slate-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                    Enable auto-scan
                  </button>
                </div>
              </div>

              {/* GATE CONTROL HARDWARE PANEL */}
              <div className="bg-[#131b2c] border border-[#1e293b] rounded-xl p-5 shadow-lg">
                <h3 className="text-xs font-bold text-slate-500 tracking-widest uppercase flex items-center gap-2 mb-6">
                  <Shield size={14} /> Gate Control Hardware
                </h3>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    {/* Visual Gate Indicator */}
                    <div className="w-16 h-12 flex items-center justify-center relative">
                      <div className="absolute left-0 w-4 h-12 bg-slate-700 rounded-sm"></div>
                      <div className={`absolute left-2 h-2 rounded-full transition-all duration-700 origin-left ${gateStatus === 'OPEN' ? 'bg-[#22c55e] w-12 -rotate-90 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-[#ef4444] w-20 shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`}></div>
                    </div>
                    
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Physical Boom Barrier</p>
                      <h4 className={`text-2xl font-black uppercase tracking-widest ${gateStatus === 'OPEN' ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                        {gateStatus}
                      </h4>
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        {gateStatus === 'OPEN' ? <Unlock size={12} /> : <Lock size={12} />} 
                        {gateStatus === 'OPEN' ? 'Unlocked • vehicle may pass' : 'Locked • awaiting authorised vehicle'}
                      </p>
                    </div>
                  </div>
                  
                  <button onClick={handleManualOverride} className="bg-transparent border border-[#1e293b] hover:border-slate-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
                    Manual open
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-6 flex flex-col h-full">
              
              {/* AI SCAN RESULTS */}
              <div className="bg-[#131b2c] border border-[#1e293b] rounded-xl flex flex-col min-h-[300px] shadow-lg overflow-hidden flex-1">
                <div className="p-4 border-b border-[#1e293b] bg-[#0f1522]/50">
                  <h3 className="text-xs font-bold text-slate-500 tracking-widest uppercase flex items-center gap-2">
                    <Cpu size={14} /> AI Scan Results
                  </h3>
                </div>
                
                <div className="flex-1 p-6 flex flex-col items-center justify-center text-center">
                  {!lastDetection ? (
                    <div className="text-slate-500 flex flex-col items-center max-w-xs">
                      <Cpu size={32} className="mb-4 opacity-50" />
                      <p className="text-sm">Waiting for a vehicle. Capture a frame, upload a photo, or use the simulator.</p>
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col justify-start text-left animate-[fadeIn_0.3s_ease-out]">
                      {lastDetection.annotated_image_base64 && (
                        <div className="mb-4 rounded-lg overflow-hidden border border-[#1e293b]">
                          <img src={`data:image/jpeg;base64,${lastDetection.annotated_image_base64}`} className="w-full object-cover max-h-[160px]" alt="Cropped Plate" />
                        </div>
                      )}
                      
                      <div className="bg-[#0f1522] rounded-lg p-4 border border-[#1e293b] mb-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs text-slate-500 uppercase tracking-widest font-bold">Extracted Plate</span>
                          <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded uppercase border border-blue-500/20">{Math.round(lastDetection.confidence)}% CONFIDENCE</span>
                        </div>
                        <div className="bg-white px-4 py-2 rounded-md inline-block border-2 border-slate-300">
                          <span className="text-2xl font-mono font-black text-slate-900 tracking-[0.2em]">
                            {lastDetection.plate_text || lastDetection.extracted_text}
                          </span>
                        </div>
                      </div>

                      <div className="bg-[#0f1522] rounded-lg p-4 border border-[#1e293b]">
                        <span className="text-xs text-slate-500 uppercase tracking-widest font-bold block mb-2">System Decision</span>
                        <div className={`text-lg font-black uppercase tracking-wider flex items-center gap-2 ${
                          lastDetection.status?.includes('Granted') || lastDetection.access_status?.includes('Granted') ? 'text-[#22c55e]' : 
                          lastDetection.status?.includes('Partial') ? 'text-[#eab308]' : 'text-[#ef4444]'
                        }`}>
                          {lastDetection.status?.includes('Granted') || lastDetection.access_status?.includes('Granted') ? (
                            <><Unlock size={20}/> ACCESS GRANTED</>
                          ) : lastDetection.status?.includes('Partial') ? (
                            <><AlertTriangle size={20}/> PARTIAL MATCH</>
                          ) : (
                            <><Lock size={20}/> ACCESS DENIED</>
                          )}
                        </div>
                        
                        {(lastDetection.status === 'Partial Match' || lastDetection.access_status === 'Partial Match') && lastDetection.suggested_plate && (
                          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                            <p className="text-yellow-500 text-sm font-bold mb-2">Did you mean: {lastDetection.suggested_plate}?</p>
                            <button onClick={async () => {
                              await axios.post(`${API_BASE}/approve-partial`, { plate_number: lastDetection.suggested_plate });
                              setLastDetection(null);
                              fetchLogs();
                            }} className="w-full bg-yellow-600 hover:bg-yellow-500 text-white text-xs font-bold py-2 rounded">
                              APPROVE & OPEN GATE
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* RECENT EVENTS */}
              <div className="bg-[#131b2c] border border-[#1e293b] rounded-xl flex flex-col shadow-lg overflow-hidden h-[300px]">
                <div className="p-4 border-b border-[#1e293b] bg-[#0f1522]/50">
                  <h3 className="text-xs font-bold text-slate-500 tracking-widest uppercase">Recent Events</h3>
                </div>
                
                <div className="flex-1 overflow-y-auto">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-[#1e293b]">
                      {logs.slice(0, 5).map((log, i) => (
                        <tr key={i} className="hover:bg-[#1e293b]/30 transition-colors">
                          <td className="p-3 pl-4 text-xs text-slate-500 w-[80px]">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase()}
                          </td>
                          <td className="p-3 w-[160px]">
                            <span className="bg-white text-slate-900 font-mono font-bold px-2 py-1 rounded text-xs tracking-wider border border-slate-300 shadow-sm inline-block min-w-[110px] text-center">
                              {log.plate_number.replace(/(.{2})(.{2})(.{2})(.+)/, "$1 $2 $3 $4")}
                            </span>
                          </td>
                          <td className="p-3 text-slate-400 text-xs pr-4">
                            {log.status?.includes('Denied') ? 'Driver redirected to visitor desk' : 
                             log.status?.includes('Partial') ? 'Requires manual review' : 'Auto'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
      
      {/* GLOBAL STYLES injected here to avoid needing index.css edits */}
      <style>{`
        @keyframes scan { 
          0% { top: 0%; opacity: 0; } 
          10% { opacity: 1; } 
          90% { opacity: 1; } 
          100% { top: 100%; opacity: 0; } 
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function SidebarItem({ icon, label, active }) {
  return (
    <button className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${active ? 'bg-[#1e3a8a]/40 text-[#60a5fa] font-medium' : 'text-slate-400 hover:text-slate-200 hover:bg-[#1e293b]/50'}`}>
      {icon}
      {label}
    </button>
  );
}

function CameraOutline() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-30">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
      <circle cx="12" cy="13" r="3"/>
    </svg>
  );
}

export default App;
