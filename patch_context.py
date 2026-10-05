import re

with open('frontend/src/context/ALPRContext.tsx', 'r') as f:
    c = f.read()

visitor_handle = '''      if (r.kind === "visitor") {
        if (r.pass) play(sfx.success);
        else play(sfx.chime);
        openBarrier(5);
        if (!r.pass) toast.info(`Visitor logged: ${fmtPlate(r.plate)}`);
        else toast.success(`Visitor Pass Valid: ${fmtPlate(r.plate)}`);
      }'''

new_visitor_handle = '''      if (r.kind === "visitor") {
        if (r.pass) play(sfx.success);
        else play(sfx.chime);
        openBarrier(5);
        if (!r.pass) toast.info(`Visitor logged: ${fmtPlate(r.plate)}`);
        else toast.success(`Visitor Pass Valid: ${fmtPlate(r.plate)}`);
        
        // Mock WhatsApp Notification
        const flat = r.pass?.flat || r.vehicle?.flat || "Unknown";
        if (flat !== "Unknown") {
          setTimeout(() => {
            toast.success(`📱 WhatsApp Sent to Flat ${flat}: "Visitor ${fmtPlate(r.plate)} has entered the gate."`, { duration: 6000 });
          }, 1500);
        }
      }'''

c = c.replace(visitor_handle, new_visitor_handle)

with open('frontend/src/context/ALPRContext.tsx', 'w') as f:
    f.write(c)
