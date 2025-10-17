import React, { useState } from 'react';
import { IExecDataProtector } from '@iexec/dataprotector';
import { ethers } from 'ethers';

const PayrollDashboard = () => {
  const [employees, setEmployees] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);

  const PAYROLL_IAPP_ADDRESS = process.env.REACT_APP_PAYROLL_IAPP_ADDRESS;

  const addEmployee = () => {
    setEmployees([...employees, {
      walletAddress: '',
      amount: '',
      name: ''
    }]);
  };

  const updateEmployee = (index, field, value) => {
    const updated = [...employees];
    updated[index][field] = value;
    setEmployees(updated);
  };

  const processPayroll = async () => {
    setLoading(true);
    setStatus('Preparing payroll batch...');

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();

      const dataProtector = new IExecDataProtector(signer, {
        allowExperimentalNetworks: true
      });

      // Create payroll batch data
      const batchData = {
        metadata: {
          batchId: `BATCH-${Date.now()}`,
          payDate: Date.now() + 24 * 60 * 60 * 1000 // Tomorrow
        },
        employees: employees.map((emp, idx) => ({
          id: `EMP-${idx}`,
          walletAddress: emp.walletAddress,
          paymentInfo: {
            tokenContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' // USDC
          },
          compensation: {
            netPay: ethers.parseUnits(emp.amount, 6).toString()
          }
        })),
        summary: {
          totalNetPay: employees.reduce((sum, emp) => 
            sum + parseFloat(emp.amount), 0
          ).toString()
        }
      };

      // Protect the batch data
      setStatus('Encrypting payroll data...');
      const { address } = await dataProtector.protectData({
        data: batchData,
        name: `Payroll-${batchData.metadata.batchId}`
      });

      // Grant access
      setStatus('Granting access to processor...');
      await dataProtector.grantAccess({
        protectedData: address,
        authorizedApp: PAYROLL_IAPP_ADDRESS,
        authorizedUser: ethers.ZeroAddress
      });

      // Process the batch
      setStatus('Processing payroll in TEE...');
      const { taskId } = await dataProtector.processProtectedData({
        protectedData: address,
        app: PAYROLL_IAPP_ADDRESS
      });

      // Wait for results
      setStatus('Generating payment vouchers...');
      let result = null;
      let attempts = 0;

      while (!result && attempts < 60) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        try {
          result = await dataProtector.getResultFromCompletedTask({ taskId });
          if (result) {
            setResults(result);
            setStatus(`Generated ${result.vouchers.length} payment vouchers`);
          }
        } catch (err) {
          if (!err.message.includes('not completed')) throw err;
        }
        attempts++;
      }

    } catch (error) {
      console.error('Error:', error);
      setStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="payroll-dashboard">
      <h2>Confidential Payroll Processing</h2>

      <div className="employees-section">
        <h3>Employees</h3>
        {employees.map((emp, idx) => (
          <div key={idx} className="employee-row">
            <input
              placeholder="Wallet Address"
              value={emp.walletAddress}
              onChange={(e) => updateEmployee(idx, 'walletAddress', e.target.value)}
            />
            <input
              placeholder="Amount (USDC)"
              type="number"
              step="0.01"
              value={emp.amount}
              onChange={(e) => updateEmployee(idx, 'amount', e.target.value)}
            />
            <input
              placeholder="Name (optional)"
              value={emp.name}
              onChange={(e) => updateEmployee(idx, 'name', e.target.value)}
            />
          </div>
        ))}
        
        <button onClick={addEmployee}>Add Employee</button>
      </div>

      <button 
        onClick={processPayroll} 
        disabled={loading || employees.length === 0}
      >
        {loading ? 'Processing...' : 'Process Payroll'}
      </button>

      {status && <div className="status">{status}</div>}

      {results && (
        <div className="results">
          <h3>Payroll Results</h3>
          <p>Batch ID: {results.batchId}</p>
          <p>Generated {results.vouchers.length} vouchers</p>
          <details>
            <summary>View Vouchers</summary>
            <pre>{JSON.stringify(results.vouchers, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  );
};

export default PayrollDashboard;