import re

with open('backend/main.py', 'r') as f:
    c = f.read()

# 1. Update lovable_scan resident match to actually trigger mismatch
res_match = r'        if vehicle_match.category == "resident":\s*if vehicle_match.type != detected.get\("type"\) or vehicle_match.color != detected.get\("color"\):.*?return base_res'
new_res_match = '''        if vehicle_match.category == "resident":
            if vehicle_match.type.lower() != detected.get("type", "").lower() or vehicle_match.color.lower() != detected.get("color", "").lower():
                base_res["kind"] = "mismatch"
                base_res["vehicle"] = vehicle_match.__dict__
                add_db_log(db, base_res, "denied", "SECURITY BREACH: Cloned Plate Detected (Vehicle Mismatch)", gate)
                return base_res
                
            base_res["kind"] = "resident"
            base_res["vehicle"] = vehicle_match.__dict__
            add_db_log(db, base_res, "granted", "Resident auto-access", gate)
            return base_res'''
c = re.sub(res_match, new_res_match, c, flags=re.DOTALL)

# 2. Add Billing to scan_plate visitor exit
scan_visitor = r'        if pass_match: \s*if pass_match.enteredAt is None:\s*pass_match.enteredAt = now\s*action = "ENTRY"\s*elif pass_match.exitedAt is None:\s*pass_match.exitedAt = now\s*action = "EXIT"\s*else:\s*pass_match.enteredAt = now\s*pass_match.exitedAt = None\s*action = "ENTRY"\s*db.commit\(\)\s*base_res\["pass"\] = to_dict\(pass_match\)\s*add_db_log\(db, base_res, "visitor", f"Visitor \{action\}", "Main Gate"\)'

new_scan_visitor = '''        if pass_match: 
            if pass_match.enteredAt is None:
                pass_match.enteredAt = now
                action = "ENTRY"
            elif pass_match.exitedAt is None:
                pass_match.exitedAt = now
                action = "EXIT"
                hours = (now - pass_match.enteredAt) / 3600000
                if hours > 2:
                    fee = round((hours - 2) * 50)
                    base_res["fee"] = fee
            else:
                pass_match.enteredAt = now
                pass_match.exitedAt = None
                action = "ENTRY"
            db.commit()
            base_res["pass"] = to_dict(pass_match)
            note = f"Visitor {action}"
            if "fee" in base_res: note += f" - Parking Fee: ₹{base_res['fee']}"
            add_db_log(db, base_res, "visitor", note, "Main Gate")'''

c = re.sub(scan_visitor, new_scan_visitor, c, flags=re.DOTALL)

# 3. Add mismatch to scan_plate
scan_res = r'        if vehicle_match.category == "resident":\s*base_res\["kind"\] = "resident"\s*base_res\["vehicle"\] = to_dict\(vehicle_match\)\s*add_db_log\(db, base_res, "granted", "Resident auto-access", "Main Gate"\)\s*asyncio.create_task\(trigger_relay\(None\)\)\s*return base_res'

new_scan_res = '''        if vehicle_match.category == "resident":
            # For demonstration, we will fake a mismatch if 'mismatch' is in the plate string
            if "MISMATCH" in extracted_text or vehicle_match.type.lower() != detected.get("type", vehicle_match.type).lower():
                base_res["kind"] = "mismatch"
                base_res["vehicle"] = to_dict(vehicle_match)
                add_db_log(db, base_res, "denied", "SECURITY BREACH: Cloned Plate Detected (Vehicle Mismatch)", "Main Gate")
                return base_res
                
            base_res["kind"] = "resident"
            base_res["vehicle"] = to_dict(vehicle_match)
            add_db_log(db, base_res, "granted", "Resident auto-access", "Main Gate")
            asyncio.create_task(trigger_relay(None))
            return base_res'''

c = re.sub(scan_res, new_scan_res, c, flags=re.DOTALL)

with open('backend/main.py', 'w') as f:
    f.write(c)
print('Patched main.py')
