import React, { useState, useContext } from 'react';
import { ethers } from 'ethers';
import { DataProtectorContext } from '../App';

const PayrollDashboard = () => {
  const [employees, setEmployees] = useState([
    { walletAddress: '', amount: '', name: '' }
  ]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [taskId, setTaskId] = useState(null);
  const [protectedDataAddress, setProtectedDataAddress] = useState(null);
  
  const { dataProtector, dpError } = useContext(DataProtectorContext);

  const PAYROLL_IAPP_ADDRESS = process.env.REACT_APP_PAYROLL_IAPP_ADDRESS || 
                               '0xA1956e4Be8F0b5d421c5B8806872b6d109Eec23c';

  const addEmployee = () => {
    setEmployees([...employees, {
      walletAddress: '',
      amount: '',
      name: ''
    }]);
  };

  const removeEmployee = (index) => {
    const updated = employees.filter((_, i) => i !== index);
    setEmployees(updated);
  };

  const updateEmployee = (index, field, value) => {
    const updated = [...employees];
    updated[index][field] = value;
    setEmployees(updated);
  };

  const processPayroll = async () => {
    const validEmployees = employees.filter(emp => 
      emp.walletAddress && emp.amount && parseFloat(emp.amount) > 0
    );
    
    if (validEmployees.length === 0) {
      setStatus('❌ Error: Please add at least one employee with valid data');
      return;
    }

    if (!dataProtector) {
      setStatus('❌ Error: Please connect your wallet first');
      return;
    }

    console.log('--- VERIFYING ADDRESS ---');
    console.log('Using iApp Address:', PAYROLL_IAPP_ADDRESS);
    console.log('--- VERIFYING ADDRESS ---');


    setLoading(true);
    setStatus('🔄 Preparing confidential payroll batch...');
    setResults(null);
    setTaskId(null);
    setProtectedDataAddress(null);

    try {
      // Prepare employee data array
      const employeesData = validEmployees.map((emp, idx) => ({
        id: `EMP-${idx}`,
        name: emp.name || `Employee ${idx + 1}`,
        walletAddress: emp.walletAddress,
        tokenContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        amount: ethers.parseUnits(emp.amount || '0', 6).toString()
      }));

      // Create FLAT payroll data structure
      const payrollData = {
        batchId: `BATCH-${Date.now()}`,
        payDate: String(Date.now() + 24 * 60 * 60 * 1000),
        totalEmployees: String(validEmployees.length),
        employeesJson: JSON.stringify(employeesData) // Serialize array to string
      };

      console.log('📦 Payroll batch prepared');

      // Step 1: Protect the data
      setStatus('Step 1/4: 🔐 Encrypting payroll data...');
      
      const protectResult = await dataProtector.core.protectData({
        data: payrollData,
        name: `Payroll Batch ${payrollData.batchId}`
      });
      
      const currentProtectedDataAddress = protectResult.address;
      setProtectedDataAddress(currentProtectedDataAddress);
      console.log('✅ Data encrypted at:', currentProtectedDataAddress);

      // Step 2: Grant access to the payroll iApp
      setStatus('Step 2/4: 🔓 Granting access to payroll processor...');
      
      await dataProtector.core.grantAccess({
        protectedData: currentProtectedDataAddress,
        authorizedApp: PAYROLL_IAPP_ADDRESS,
        authorizedUser: ethers.ZeroAddress
      });
      
      console.log('✅ Access granted to payroll iApp');

      // Step 3: Process the protected data in TEE
      setStatus('Step 3/4: 🔒 Processing payroll in secure enclave...');

      const processResult = await dataProtector.core.processProtectedData({
        protectedData: currentProtectedDataAddress,
        app: PAYROLL_IAPP_ADDRESS,
        tee: true 
      });

      const currentTaskId = processResult.taskId;
      setTaskId(currentTaskId);

      console.log('✅ Task created:', currentTaskId);
      
      // Step 4: Wait for results
      setStatus('Step 4/4: ⏳ Generating payment vouchers (30-90 seconds)...');
      
      let taskResult = null;
      let attempts = 0;
      const maxAttempts = 40;
      const baseDelay = 3000;

      while (!taskResult && attempts < maxAttempts) {
        const delay = Math.min(baseDelay + (attempts * 1000), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        try {
          taskResult = await dataProtector.core.getResultFromCompletedTask({
            taskId: currentTaskId
          });
          
          if (taskResult) {
            console.log('✅ RAW TASK RESULT:', taskResult);
            
            let parsedResult;
            try {
              parsedResult = typeof taskResult === 'string' 
                ? JSON.parse(taskResult) 
                : taskResult;
              
              console.log('✅ PARSED RESULT:', parsedResult);
            } catch (parseError) {
              console.log('⚠️ Result is not JSON:', taskResult);
              parsedResult = { raw: taskResult };
            }
            
            setResults({
              status: 'completed',
              taskId: currentTaskId,
              protectedDataAddress: currentProtectedDataAddress,
              result: parsedResult,
              employees: validEmployees.map(emp => emp.name || 'Employee'),
              vouchers: parsedResult.vouchers || []
            });
            
            setStatus(`✅ Successfully generated ${validEmployees.length} payment vouchers!`);
            break;
          }
        } catch (pollError) {
          console.log(`⏳ Polling attempt ${attempts + 1}/${maxAttempts}`);
        }
        
        attempts++;
        const elapsed = Math.round(attempts * delay / 1000);
        const progress = Math.round((attempts / maxAttempts) * 100);
        setStatus(`Step 4/4: 🔒 Processing securely... (${progress}% - ${elapsed}s elapsed)`);
      }

      if (!taskResult && attempts >= maxAttempts) {
        console.log('⚠️ Task timeout reached');
        
        setResults({
          status: 'processing',
          taskId: currentTaskId,
          protectedDataAddress: currentProtectedDataAddress,
          message: 'Task is still processing. Check iExec Explorer for status.',
          employees: validEmployees.map(emp => emp.name || 'Employee')
        });
        
        setStatus(`⏳ Task may still be processing. Task ID: ${currentTaskId}`);
      }

    } catch (error) {
      console.error('❌ Payroll processing error:', error);
      
      let errorMessage = '❌ Error: ';
      
      if (error.message?.includes('insufficient funds') || error.message?.includes('Insufficient RLC')) {
        errorMessage += error.message;
      } else if (error.message?.includes('User denied') || error.message?.includes('rejected')) {
        errorMessage += 'Transaction was cancelled by user.';
      } else {
        errorMessage += error.message || 'Failed to process payroll. Please try again.';
      }
      
      setStatus(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const downloadResults = () => {
    if (!results) return;
    
    const dataStr = JSON.stringify(results, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    
    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', `payroll-results-${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="payroll-dashboard">
      <h2>💼 Confidential Payroll Processing</h2>
      <p className="subtitle">End-to-end encrypted payroll processing</p>

      {dpError && (
        <div className="error-message">
          ⚠️ DataProtector Error: {dpError}
        </div>
      )}

      <div className="employees-section">
        <h3>Employees ({employees.length})</h3>
        
        {employees.length === 0 ? (
          <div className="empty-state">
            <p>No employees added yet</p>
          </div>
        ) : (
          <div className="employees-list">
            {employees.map((emp, idx) => (
              <div key={idx} className="employee-row">
                <input
                  placeholder="Wallet Address (0x...)"
                  value={emp.walletAddress}
                  onChange={(e) => updateEmployee(idx, 'walletAddress', e.target.value)}
                  disabled={loading}
                />
                <input
                  placeholder="Amount (USDC)"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={emp.amount}
                  onChange={(e) => updateEmployee(idx, 'amount', e.target.value)}
                  disabled={loading}
                />
                <input
                  placeholder="Name (optional)"
                  value={emp.name}
                  onChange={(e) => updateEmployee(idx, 'name', e.target.value)}
                  disabled={loading}
                />
                <button 
                  type="button"
                  className="remove-button"
                  onClick={() => removeEmployee(idx)}
                  disabled={loading}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        
        <button 
          type="button"
          className="add-button" 
          onClick={addEmployee}
          disabled={loading}
        >
          + Add Employee
        </button>
      </div>

      {employees.length > 0 && (
        <div className="summary-section">
          <h3>Batch Summary</h3>
          <p><strong>Total Employees:</strong> {employees.length}</p>
          <p><strong>Total Amount:</strong> {employees.reduce((sum, emp) => sum + (parseFloat(emp.amount) || 0), 0).toFixed(2)} USDC</p>
        </div>
      )}

      <button 
        className="process-button"
        onClick={processPayroll} 
        disabled={loading || !dataProtector}
      >
        {loading ? '⏳ Processing Securely...' : '🔒 Process Payroll Confidentially'}
      </button>

      {status && (
        <div className={`status ${status.includes('✅') ? 'success' : ''} ${status.includes('❌') ? 'error' : ''}`}>
          {status.split('\n').map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}

      {protectedDataAddress && (
        <div className="protected-data-info">
          <p><strong>🔐 Encrypted Data Address:</strong></p>
          <code>{protectedDataAddress}</code>
        </div>
      )}

      {taskId && (
        <div className="task-info">
          <p><strong>Task ID:</strong> <code>{taskId}</code></p>
          <a 
            href={`https://explorer.iex.ec/arbitrum-sepolia/${taskId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="explorer-link"
          >
            📊 View Task on iExec Explorer →
          </a>
        </div>
      )}

      {results && (
        <div className="results">
          <h3>✅ Payroll Processing Complete</h3>
          <div className="results-summary">
            <p><strong>Status:</strong> {results.status === 'completed' ? '✅ Successfully Processed' : '⏳ Processing'}</p>
            <p><strong>Vouchers Generated:</strong> {results.vouchers?.length || employees.filter(emp => emp.walletAddress && emp.amount).length}</p>
            
            {results.vouchers && results.vouchers.length > 0 && (
              <div className="vouchers-list">
                <h4>Payment Vouchers:</h4>
                {results.vouchers.map((voucher, idx) => (
                  <div key={idx} className="voucher-item">
                    <span>💳 {voucher.employeeName}: {ethers.formatUnits(voucher.data.amount, 6)} USDC</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {results.result && (
            <details>
              <summary>View Raw Result</summary>
              <pre>{JSON.stringify(results.result, null, 2)}</pre>
            </details>
          )}
          
          <button onClick={downloadResults} className="download-button">
            💾 Download Results
          </button>
        </div>
      )}

    </div>
  );
};

export default PayrollDashboard;