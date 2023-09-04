import { ethers } from 'ethers';
import { useEffect, useState } from 'react';
import deploy from './deploy';

const provider = new ethers.providers.Web3Provider(window.ethereum);

export async function approve(escrowContract, signer) {
  console.log({ escrowContract })
  const approveTxn = await escrowContract.connect(signer).approve();
  await approveTxn.wait();
}

const STATUS = {
  NONE: 'none',
  CREATING: 'creating',
  LOADING: 'loading',
  APPROVED: 'approved',
  DEPLOYED: 'deployes',
  APPROVING: 'approving'
}

function App() {
  const [escrow, setEscrow] = useState(null);
  const [account, setAccount] = useState();
  const [balance, setBalance] = useState(0);
  const [signer, setSigner] = useState();
  const [status, setStatus] = useState(STATUS.NONE)
  const [contractStatus, setContractStatus] = useState('Not Deployed Yet')
  const [actor, setActor] = useState('Buyer')
  const [action, setAction] = useState('Deploy')

  useEffect(() => {
    if (account) {
      provider.on("block", () => {
        provider.getBalance(account).then((newBalance) => {
          console.log({ newBalance: newBalance })
          setBalance(newBalance);
        });
      });
    }
  }, [])

  useEffect(() => {
    async function getAccounts() {
      const accounts = await provider.send('eth_requestAccounts', []);
      const balance = await provider.send('eth_getBalance', [accounts[0]]);
      setBalance(ethers.utils.formatEther(balance))
      setAccount(accounts[0]);
      setSigner(provider.getSigner());
    }

    getAccounts();
  }, [account]);

  useEffect(() => {
    if (escrow) {
      console.log({
        escrow,
        account
      })
      if (escrow.status == 'deployed' && account == escrow.arbiter) {
        setActor('Arbiter');
        setStatus(STATUS.APPROVING)
        setAction('Approve');
        setContractStatus('Pending');
      }
    }
  }, [escrow, account])

  function createNewContract() {
    if (status === STATUS.NONE) {
      setStatus(STATUS.CREATING)
      setActor('Buyer')
    }
  }

  async function actionClicked() {
    if (action == 'No Action') return;

    if (status === STATUS.CREATING) {
      const beneficiary = document.getElementById('beneficiary').value.toString().toLowerCase();
      if (beneficiary.length < 42) {
        document.getElementById('beneficiary').focus();
        return;
      }

      const arbiter = document.getElementById('arbiter').value.toString().toLowerCase();
      if (arbiter.length < 42) {
        document.getElementById('arbiter').focus();
        return;
      }

      const value = document.getElementById('value').value.toString().toLowerCase()
      if (parseFloat('0' + value) <= 0) {
        document.getElementById('value').focus();
        return;
      }
      const eth = ethers.utils.parseEther(document.getElementById('value').value);
      try {
        setContractStatus('Deploying');
        let escrowContract = await deploy(signer, arbiter, beneficiary, eth)
        setContractStatus('Verifying');
        await escrowContract.deployTransaction.wait()
        const escrow = {
          address: escrowContract.address,
          buyer: account,
          arbiter,
          beneficiary,
          status: 'deployed',
          value: value.toString(),
          handleApprove: async () => {
            escrowContract.on('Approved', () => {
              setContractStatus('Approved');
              setAction('NO Action')
              setStatus(STATUS.APPROVED)
            });

            await approve(escrowContract, signer);
          },
        };
        setContractStatus('Deployed');
        setEscrow(escrow);
        setStatus(STATUS.DEPLOYED)
        setAction('No Action')
      } catch (err) {
        setContractStatus('Deployment Error');
        alert('Error while deploying')
      }
    }
    else if (status === STATUS.APPROVING) {
      await escrow?.handleApprove();
    }
  }

  function reset() {
    setEscrow(null)
    setStatus(STATUS.NONE)
    setContractStatus('Not Deployed yet');
    setActor('Buyer')
  }

  return (
    <>
      <div className="flex min-h-screen w-full flex-col items-center justify-center py-12">
        <div className="m-full max-w-3xl py-8">
          <div className="w-full text-center text-3xl">Eth-Escrow</div>
        </div>
        <div className="m-full max-w-3xl rounded bg-white p-4 shadow">
          {account && (
            <div className="flex w-full items-center justify-between pb-4">
              <div className="text-sm">{account}</div>
              <div className="text-sm pl-2">{parseFloat('0' + balance.toString()).toFixed(4)} ETH</div>
            </div>
          )}
          {[STATUS.NONE].includes(status) && (
            <div className="flex w-full items-center justify-between border-b pb-4">
              <button className="flex-grow rounded-lg bg-blue-700 px-8 py-2 text-white" onClick={createNewContract}>Create a new contract</button>
            </div>
          )}
          {[STATUS.NONE].includes(status) && (
            <div className="w-full py-12 px-20">
              <div className="text-lg w-full text-center text-slate-400">No contract is loaded</div>
            </div>
          )}
          {[STATUS.CREATING, STATUS.DEPLOYED, STATUS.APPROVING, STATUS.APPROVED].includes(status) && (
            <>
              <div className="w-full py-4">
                {[STATUS.LOADING].includes(status) && (
                  <div className="flex w-full py-1">
                    <input type="text" className="flex-grow rounded-l-lg border p-2" placeholder="Contract Address" />
                    <button className="rounded-r-lg border bg-blue-700 px-8 py-2 text-white">Load</button>
                  </div>
                )}
                {[STATUS.CREATING].includes(status) && (
                  <>
                    <div className="flex w-full py-1">
                      <button className="rounded-l-lg border bg-white px-8 py-2">Benificiary</button>
                      <input type="text" className="flex-grow rounded-r-lg border p-2" id="beneficiary" placeholder="0xabc00...." />
                    </div>
                    <div className="flex w-full py-1">
                      <button className="rounded-l-lg border bg-white px-8 py-2">Arbiter</button>
                      <input type="text" className="flex-grow rounded-r-lg border p-2" id="arbiter" placeholder="0xabc00...." />
                    </div>
                  </>
                )}
              </div>
              {escrow && (
                <div className="w-full p-4 flex flex-col">
                  <div className="text-sm">Buyer : {escrow.buyer}</div>
                  <div className="text-sm py-2">Arbiter : {escrow.arbiter}</div>
                  <div className="text-sm">Benificiary : {escrow.beneficiary}</div>
                </div>
              )}
              <div className="flex w-full border-t pt-4">
                <div className="flex w-3/4 flex-col justify-evenly">
                  <div className="w-full text-lg">Welcome {actor}</div>
                  <div className="flex w-full py-4">
                    <button className="whitespace-nowrap rounded-l-lg border bg-white px-2 py-2"  >Value in ETH :</button>
                    <input className="flex-grow rounded-r-lg border p-2" disabled={status != STATUS.CREATING} id="value" type="number" step="0.001" />
                  </div>
                  <div className="flex w-full">
                    <div className="text-md mr-4">Status :</div>
                    <div className="rounded-lg border px-2 py-1 text-xs">{contractStatus}</div>
                  </div>
                </div>
                <div className="flex w-3/4 items-center justify-center p-4">
                  <button className="h-32 w-32 cursor-pointer rounded-full border shadow hover:bg-slate-50" onClick={actionClicked}>{action}</button>
                </div>
              </div>
            </>
          )}
          {escrow && (
            <div className='w-full py-4 flex justify-center'>
              <button className="rounded-lg bg-blue-700 px-8 py-2 text-white" onClick={reset}>Reset</button>
            </div>
          )}
        </div>
      </div>

    </>
  );
}

export default App;
