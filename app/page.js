"use client";

import { useEffect, useState } from "react";
import { Monitor, ArrowsHorizontal } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import useWebSocket from "react-use-websocket";

export default function Home() {
  const [flashBlocks, setFlashBlocks] = useState([]);
  const [baseBlocks, setBaseBlocks] = useState([]);
  const [isFlashConnected, setIsFlashConnected] = useState(false);
  const [isBaseConnected, setIsBaseConnected] = useState(false);
  const [baseConnectionAttempts, setBaseConnectionAttempts] = useState(0);
  const [baseLastError, setBaseLastError] = useState(null);
  const [blockTimings, setBlockTimings] = useState({});
  const [flashMessagesCount, setFlashMessagesCount] = useState(0);
  const [baseMessagesCount, setBaseMessagesCount] = useState(0);
  const [raceWinner, setRaceWinner] = useState(null);
  const [totalFlashBlocks, setTotalFlashBlocks] = useState(0);
  const [totalBaseBlocks, setTotalBaseBlocks] = useState(0);
  
  // Flash Blocks WebSocket
  const { lastMessage: flashLastMessage } = useWebSocket("wss://sepolia.flashblocks.base.org/ws", {
    onOpen: () => setIsFlashConnected(true),
    onClose: () => setIsFlashConnected(false),
    onError: () => setIsFlashConnected(false),
    onMessage: async (event) => {
      // Increment message counter
      setFlashMessagesCount(prev => prev + 1);
      
      try {
        // Handle Blob data
        const text = event.data instanceof Blob 
          ? await event.data.text() 
          : event.data;
        
        const data = JSON.parse(text);
        // Extract relevant block information from the response structure
        const blockInfo = {
          number: data.metadata?.block_number || parseInt(data.base?.block_number, 16) || 'Unknown',
          hash: data.diff?.block_hash || 'Unknown',
          timestamp: parseInt(data.base?.timestamp, 16) || Math.floor(Date.now() / 1000),
          transactions: data.diff?.transactions?.length || 0,
          gasUsed: data.diff?.gas_used ? parseInt(data.diff.gas_used, 16) : 'Unknown',
          baseFeePerGas: data.base?.base_fee_per_gas ? parseInt(data.base.base_fee_per_gas, 16) : 'Unknown',
          source: 'flash',
          receivedAt: Date.now()
        };
        
        // Update block timings
        setBlockTimings(prev => {
          const blockNumber = blockInfo.number;
          return {
            ...prev,
            [blockNumber]: {
              ...prev[blockNumber],
              flash: blockInfo.receivedAt
            }
          };
        });
        
        setFlashBlocks(prev => {
          // Check if block already exists in the array
          if (prev.some(block => block.number === blockInfo.number)) {
            return prev; // Skip adding duplicate block
          }
          
          // Increment total flash blocks counter
          setTotalFlashBlocks(current => current + 1);
          
          return [blockInfo, ...prev].slice(0, 5);
        });
      } catch (error) {
        console.error("Failed to parse Flash websocket message:", error);
      }
    },
    reconnectAttempts: 10,
    reconnectInterval: 3000,
    shouldReconnect: (closeEvent) => true,
  });

  // Base Blocks WebSocket
  const { lastMessage: baseLastMessage, readyState: baseReadyState, sendMessage: baseSendMessage } = useWebSocket("wss://base-sepolia-rpc.publicnode.com", {
    onOpen: () => {
      console.log("Base WebSocket connected successfully");
      setIsBaseConnected(true);
      setBaseLastError(null);
      
      // Add a small delay before sending the subscription message
      // to ensure the connection is fully established
      setTimeout(() => {
        try {
          // Subscribe to new block headers after connection is established
          const subscribeMessage = JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "eth_subscribe",
            params: ["newHeads"]
          });
          baseSendMessage(subscribeMessage);
          console.log("Sent subscription request to Base WebSocket");
        } catch (error) {
          console.error("Failed to send subscription message:", error);
          setBaseLastError(`Failed to subscribe: ${error.message || 'Unknown error'}`);
        }
      }, 500);
    },
    onClose: (event) => {
      console.error("Base WebSocket closed", {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean
      });
      setIsBaseConnected(false);
      setBaseLastError(`Connection closed: ${event.code} ${event.reason || ''}`);
    },
    onError: (error) => {
      console.error("Base WebSocket error:", error);
      setIsBaseConnected(false);
      setBaseLastError(`Error: ${error.message || 'Unknown error'}`);
    },
    onMessage: async (event) => {
      // Increment message counter
      setBaseMessagesCount(prev => prev + 1);
      
      console.log("Base WebSocket message received:", event.data);
      try {
        // Handle Blob data
        const text = event.data instanceof Blob 
          ? await event.data.text() 
          : event.data;
        
        const data = JSON.parse(text);
        
        // Check if this is a subscription response or actual block data
        if (data.result && !data.params) {
          console.log("Subscription confirmed with ID:", data.result);
          return;
        }
        
        // Extract block data from subscription update
        const blockData = data.params?.result;
        if (!blockData) {
          console.log("Received non-block data:", data);
          return;
        }
        
        // Extract relevant block information
        const blockInfo = {
          number: parseInt(blockData.number, 16) || 'Unknown',
          hash: blockData.hash || 'Unknown',
          timestamp: parseInt(blockData.timestamp, 16) || Math.floor(Date.now() / 1000),
          transactions: blockData.transactions?.length || 0,
          gasUsed: blockData.gasUsed ? parseInt(blockData.gasUsed, 16) : 'Unknown',
          baseFeePerGas: blockData.baseFeePerGas ? parseInt(blockData.baseFeePerGas, 16) : 'Unknown',
          source: 'base',
          receivedAt: Date.now()
        };
        
        // Update block timings
        setBlockTimings(prev => {
          const blockNumber = blockInfo.number;
          return {
            ...prev,
            [blockNumber]: {
              ...prev[blockNumber],
              base: blockInfo.receivedAt
            }
          };
        });
        
        console.log("Processed Base block:", blockInfo);
        
        setBaseBlocks(prev => {
          // Check if block already exists in the array
          if (prev.some(block => block.number === blockInfo.number)) {
            return prev; // Skip adding duplicate block
          }
          
          // Increment total base blocks counter
          setTotalBaseBlocks(current => current + 1);
          
          return [blockInfo, ...prev].slice(0, 5);
        });
      } catch (error) {
        console.error("Failed to parse Base websocket message:", error);
      }
    },
    reconnectAttempts: 10,
    reconnectInterval: 3000,
    shouldReconnect: (closeEvent) => {
      setBaseConnectionAttempts(prev => prev + 1);
      console.log("Base WebSocket attempting to reconnect", closeEvent);
      return true;
    },
  });

  // Combine and sort blocks for comparison
  const allBlocks = [...flashBlocks, ...baseBlocks]
    .sort((a, b) => b.number - a.number)
    .reduce((acc, block) => {
      const existingIndex = acc.findIndex(item => item.number === block.number);
      if (existingIndex === -1) {
        // Block doesn't exist yet, add it with its source
        acc.push({
          number: block.number,
          [block.source]: block
        });
      } else {
        // Block exists, add this source's data
        acc[existingIndex][block.source] = block;
      }
      return acc;
    }, [])
    .slice(0, 5);

  // Calculate timing statistics
  const timingStats = {
    flashFaster: 0,
    baseFaster: 0,
    equal: 0,
    total: 0
  };

  Object.values(blockTimings).forEach(timing => {
    if (timing.flash && timing.base) {
      timingStats.total++;
      const diff = timing.flash - timing.base;
      if (diff < -50) { // Flash is faster (with 50ms threshold to account for processing time)
        timingStats.flashFaster++;
      } else if (diff > 50) { // Base is faster
        timingStats.baseFaster++;
      } else { // Roughly equal
        timingStats.equal++;
      }
    }
  });

  // Check for race winner based on message counts
  useEffect(() => {
    if (raceWinner) return; // Race already has a winner
    
    if (flashMessagesCount >= 420 && baseMessagesCount < 420) {
      setRaceWinner('flash');
    } else if (baseMessagesCount >= 420 && flashMessagesCount < 420) {
      setRaceWinner('base');
    } else if (flashMessagesCount >= 420 && baseMessagesCount >= 420) {
      // Both reached the goal at the same time (or in the same render cycle)
      setRaceWinner('tie');
    }
  }, [flashMessagesCount, baseMessagesCount, raceWinner]);

  return (
    <div className="grid grid-rows-[auto_auto_1fr] min-h-screen p-8 pb-20 gap-8 sm:p-20 bg-slate-900">
      <header className="flex items-center gap-4">
        <Monitor size={32} className="text-white" weight="bold" />
        <h1 className="text-3xl font-bold text-white">Base Sepolia Block Comparison</h1>
      </header>

      {/* Race Track UI */}
      <div className="bg-slate-800 rounded-xl p-6 shadow-lg border-4 border-slate-700">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <ArrowsHorizontal size={24} weight="bold" className="text-white" />
          Block Race - First to 420 Blocks Wins!
        </h2>
        
        <div className="space-y-6">
          {/* Flash Blocks Track */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-white mb-1">
              <div className="h-3 w-3 bg-green-400 rounded-full"></div>
              <span>Flash: {flashMessagesCount} blocks</span>
            </div>
            
            <div className="relative h-8 bg-slate-700 rounded-lg overflow-hidden">
              {/* Finish Line */}
              <div className="absolute right-0 top-0 bottom-0 w-1 bg-white z-10 flex items-center justify-center">
                <div className="absolute -left-7 text-white font-bold">420</div>
              </div>
              
              {/* Progress Markers */}
              {[100, 200, 300].map(marker => (
                <div 
                  key={`flash-${marker}`} 
                  className="absolute top-0 bottom-0 w-px bg-slate-600 z-0 flex items-center justify-center"
                  style={{ left: `${(marker / 420) * 100}%` }}
                >
                  <div className="absolute -left-4 text-slate-400 text-sm">{marker}</div>
                </div>
              ))}
              
              {/* Flash Progress Bar */}
              <motion.div 
                className="absolute top-0 left-0 bottom-0 bg-green-500/30 z-0"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((flashMessagesCount / 420) * 100, 100)}%` }}
                transition={{ type: "spring", stiffness: 100, damping: 15 }}
              />
              
              {/* Flash Message Ticks - Show only the most recent 100 ticks for performance */}
              <div className="absolute top-0 left-0 bottom-0 w-full">
                {Array.from({ length: Math.min(flashMessagesCount, 100) }, (_, i) => (
                  <motion.div
                    key={`flash-tick-${i}`}
                    className="absolute top-0 bottom-0 w-0.5 bg-green-400 z-5"
                    style={{ 
                      left: `${Math.min(((flashMessagesCount - i) / 420) * 100, 100)}%`,
                      opacity: 1 - (i / 100) * 0.8 // Fade out older ticks
                    }}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1 - (i / 100) * 0.8, height: '100%' }}
                    transition={{ duration: 0.2 }}
                  />
                ))}
              </div>
              
              {/* Flash Racer */}
              <motion.div 
                className="absolute top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-green-400 shadow-lg z-20 flex items-center justify-center"
                initial={{ left: 0 }}
                animate={{ 
                  left: `${Math.min((flashMessagesCount / 420) * 100, 100)}%`,
                  scale: raceWinner === 'flash' ? [1, 1.5, 1] : 1
                }}
                transition={{ 
                  left: { type: "spring", stiffness: 100, damping: 15, mass: 0.8 },
                  scale: { repeat: raceWinner === 'flash' ? Infinity : 0, duration: 1 }
                }}
              >
                <span className="text-xs font-bold">F</span>
                {raceWinner === 'flash' && (
                  <motion.div 
                    className="absolute -top-8 whitespace-nowrap text-green-300 font-bold"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    WINNER!
                  </motion.div>
                )}
              </motion.div>
            </div>
          </div>
          
          {/* Base Blocks Track */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-white mb-1">
              <div className="h-3 w-3 bg-blue-400 rounded-full"></div>
              <span>Base: {baseMessagesCount} blocks</span>
            </div>
            
            <div className="relative h-8 bg-slate-700 rounded-lg overflow-hidden">
              {/* Finish Line */}
              <div className="absolute right-0 top-0 bottom-0 w-1 bg-white z-10 flex items-center justify-center">
                <div className="absolute -left-7 text-white font-bold">420</div>
              </div>
              
              {/* Progress Markers */}
              {[100, 200, 300].map(marker => (
                <div 
                  key={`base-${marker}`} 
                  className="absolute top-0 bottom-0 w-px bg-slate-600 z-0 flex items-center justify-center"
                  style={{ left: `${(marker / 420) * 100}%` }}
                >
                  <div className="absolute -left-4 text-slate-400 text-sm">{marker}</div>
                </div>
              ))}
              
              {/* Base Progress Bar */}
              <motion.div 
                className="absolute top-0 left-0 bottom-0 bg-blue-500/30 z-0"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((baseMessagesCount / 420) * 100, 100)}%` }}
                transition={{ type: "spring", stiffness: 100, damping: 15 }}
              />
              
              {/* Base Message Ticks - Show only the most recent 100 ticks for performance */}
              <div className="absolute top-0 left-0 bottom-0 w-full">
                {Array.from({ length: Math.min(baseMessagesCount, 100) }, (_, i) => (
                  <motion.div
                    key={`base-tick-${i}`}
                    className="absolute top-0 bottom-0 w-0.5 bg-blue-400 z-5"
                    style={{ 
                      left: `${Math.min(((baseMessagesCount - i) / 420) * 100, 100)}%`,
                      opacity: 1 - (i / 100) * 0.8 // Fade out older ticks
                    }}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1 - (i / 100) * 0.8, height: '100%' }}
                    transition={{ duration: 0.2 }}
                  />
                ))}
              </div>
              
              {/* Base Racer */}
              <motion.div 
                className="absolute top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-blue-400 shadow-lg z-20 flex items-center justify-center"
                initial={{ left: 0 }}
                animate={{ 
                  left: `${Math.min((baseMessagesCount / 420) * 100, 100)}%`,
                  scale: raceWinner === 'base' ? [1, 1.5, 1] : 1
                }}
                transition={{ 
                  left: { type: "spring", stiffness: 100, damping: 15, mass: 0.8 },
                  scale: { repeat: raceWinner === 'base' ? Infinity : 0, duration: 1 }
                }}
              >
                <span className="text-xs font-bold">B</span>
                {raceWinner === 'base' && (
                  <motion.div 
                    className="absolute -top-8 whitespace-nowrap text-blue-300 font-bold"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    WINNER!
                  </motion.div>
                )}
              </motion.div>
            </div>
          </div>
          
          {/* Tie notification */}
          {raceWinner === 'tie' && (
            <motion.div 
              className="text-center text-white font-bold py-2"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              IT'S A TIE!
            </motion.div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Flash Blocks Panel */}
        <div className="bg-slate-800 rounded-xl p-6 shadow-lg border-4 border-slate-900 flex flex-col">
          <div className={`${isFlashConnected ? 'bg-green-300' : 'bg-yellow-300'} p-4 rounded-lg font-mono text-sm mb-4 shadow-inner`}>
            <div className="flex justify-between items-center">
              <span>FLASH BLOCKS: {isFlashConnected ? 'CONNECTED' : 'CONNECTING...'}</span>
              <div className={`h-2 w-2 ${isFlashConnected ? 'bg-green-600' : 'bg-yellow-600'} rounded-full animate-pulse`} />
            </div>
            <div className="mt-2 text-xs text-slate-800">
              <div>Total blocks received: {flashMessagesCount}</div>
            </div>
          </div>

          <div className="space-y-4 overflow-y-auto flex-grow max-h-[500px]">
            <AnimatePresence>
              {flashBlocks.map((block, index) => (
                <motion.div
                  key={`flash-${block.number}-${index}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-slate-700 p-4 rounded-lg text-green-300 font-mono text-sm"
                >
                  <div className="grid grid-cols-2 gap-2">
                    <span>BLOCK #:</span>
                    <span>{block.number}</span>
                    <span>HASH:</span>
                    <span className="truncate">{block.hash}</span>
                    <span>TIMESTAMP:</span>
                    <span>{new Date(block.timestamp * 1000).toLocaleString()}</span>
                    <span>TRANSACTIONS:</span>
                    <span>{block.transactions}</span>
                    <span>GAS USED:</span>
                    <span>{block.gasUsed}</span>
                    <span>BASE FEE:</span>
                    <span>{block.baseFeePerGas} wei</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Base Blocks Panel */}
        <div className="bg-slate-800 rounded-xl p-6 shadow-lg border-4 border-slate-900 flex flex-col">
          <div className={`${isBaseConnected ? 'bg-green-300' : 'bg-yellow-300'} p-4 rounded-lg font-mono text-sm mb-4 shadow-inner`}>
            <div className="flex justify-between items-center">
              <span>BASE BLOCKS: {isBaseConnected ? 'CONNECTED' : 'CONNECTING...'}</span>
              <div className={`h-2 w-2 ${isBaseConnected ? 'bg-green-600' : 'bg-yellow-600'} rounded-full animate-pulse`} />
            </div>
            <div className="mt-2 text-xs text-slate-800">
              <div>Total blocks received: {baseMessagesCount}</div>
              {!isBaseConnected && (
                <>
                  <div>Connection attempts: {baseConnectionAttempts}</div>
                  {baseLastError && <div>Last error: {baseLastError}</div>}
                  <div>WebSocket state: {
                    baseReadyState === 0 ? 'CONNECTING' : 
                    baseReadyState === 1 ? 'OPEN' : 
                    baseReadyState === 2 ? 'CLOSING' : 
                    baseReadyState === 3 ? 'CLOSED' : 'UNKNOWN'
                  }</div>
                </>
              )}
            </div>
          </div>

          <div className="space-y-4 overflow-y-auto flex-grow max-h-[500px]">
            <AnimatePresence>
              {baseBlocks.map((block, index) => (
                <motion.div
                  key={`base-${block.number}-${index}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-slate-700 p-4 rounded-lg text-blue-300 font-mono text-sm"
                >
                  <div className="grid grid-cols-2 gap-2">
                    <span>BLOCK #:</span>
                    <span>{block.number}</span>
                    <span>HASH:</span>
                    <span className="truncate">{block.hash}</span>
                    <span>TIMESTAMP:</span>
                    <span>{new Date(block.timestamp * 1000).toLocaleString()}</span>
                    <span>TRANSACTIONS:</span>
                    <span>{block.transactions}</span>
                    <span>GAS USED:</span>
                    <span>{block.gasUsed}</span>
                    <span>BASE FEE:</span>
                    <span>{block.baseFeePerGas} wei</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
