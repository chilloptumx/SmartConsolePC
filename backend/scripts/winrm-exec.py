#!/usr/bin/env python3
"""
Execute PowerShell commands on Windows machines via WinRM from Linux.

Supports configurable transport + http/https + port so the UI can control authentication behavior.
"""
import sys
import json
import argparse
import winrm


def execute_command(host, username, password, command, transport="ntlm", use_https=False, port=5985, server_cert_validation="ignore"):
    """Execute a PowerShell command via WinRM"""
    try:
        scheme = "https" if use_https else "http"
        endpoint = f"{scheme}://{host}:{port}/wsman"

        # Create WinRM session
        kwargs = {}
        # pywinrm uses this for https certificate behavior; safe default for self-signed certs
        if use_https:
            kwargs["server_cert_validation"] = server_cert_validation

        session = winrm.Session(
            endpoint,
            auth=(username, password),
            transport=transport,
            **kwargs
        )

        # Execute PowerShell command
        result = session.run_ps(command)

        # Return results as JSON
        return {
            "success": result.status_code == 0,
            "stdout": result.std_out.decode("utf-8") if result.std_out else "",
            "stderr": result.std_err.decode("utf-8") if result.std_err else "",
            "exitCode": result.status_code,
        }
    except Exception as e:
        return {
            "success": False,
            "stdout": "",
            "stderr": str(e),
            "exitCode": 1,
        }


def parse_args(argv):
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("host")
    parser.add_argument("username")
    parser.add_argument("password")
    parser.add_argument("command")
    parser.add_argument("--transport", default="ntlm")
    parser.add_argument("--use-https", action="store_true", default=False)
    parser.add_argument("--port", type=int, default=5985)
    parser.add_argument("--server-cert-validation", default="ignore")
    return parser.parse_args(argv)


if __name__ == "__main__":
    try:
        args = parse_args(sys.argv[1:])
    except Exception:
        print(
            json.dumps(
                {
                    "success": False,
                    "stdout": "",
                    "stderr": "Usage: winrm-exec.py <host> <username> <password> <command> [--transport ntlm|kerberos|credssp] [--use-https] [--port 5985|5986]",
                    "exitCode": 1,
                }
            )
        )
        sys.exit(1)

    result = execute_command(
        args.host,
        args.username,
        args.password,
        args.command,
        transport=args.transport,
        use_https=args.use_https,
        port=args.port,
        server_cert_validation=args.server_cert_validation,
    )
    print(json.dumps(result))

