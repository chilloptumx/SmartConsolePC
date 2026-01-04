#!/usr/bin/env python3
"""
Execute PowerShell commands on Windows machines via WinRM from Linux
"""
import sys
import json
import winrm

def execute_command(host, username, password, command):
    """Execute a PowerShell command via WinRM"""
    try:
        # Create WinRM session
        session = winrm.Session(
            f'http://{host}:5985/wsman',
            auth=(username, password),
            transport='ntlm'
        )
        
        # Execute PowerShell command
        result = session.run_ps(command)
        
        # Return results as JSON
        return {
            'success': result.status_code == 0,
            'stdout': result.std_out.decode('utf-8') if result.std_out else '',
            'stderr': result.std_err.decode('utf-8') if result.std_err else '',
            'exitCode': result.status_code
        }
    except Exception as e:
        return {
            'success': False,
            'stdout': '',
            'stderr': str(e),
            'exitCode': 1
        }

if __name__ == '__main__':
    if len(sys.argv) != 5:
        print(json.dumps({
            'success': False,
            'stdout': '',
            'stderr': 'Usage: winrm-exec.py <host> <username> <password> <command>',
            'exitCode': 1
        }))
        sys.exit(1)
    
    host = sys.argv[1]
    username = sys.argv[2]
    password = sys.argv[3]
    command = sys.argv[4]
    
    result = execute_command(host, username, password, command)
    print(json.dumps(result))

