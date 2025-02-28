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
      
      // Subscribe to new block headers after connection is established
      const subscribeMessage = JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_subscribe",
        params: ["newHeads"]
      });
      baseSendMessage(subscribeMessage);
      console.log("Sent subscription request to Base WebSocket");
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

  return (
    <div className="grid grid-rows-[auto_1fr] min-h-screen p-8 pb-20 gap-8 sm:p-20 bg-slate-900">
      <header className="flex items-center gap-4">
        <Monitor size={32} className="text-white" weight="bold" />
        <h1 className="text-3xl font-bold text-white">Base Sepolia Block Comparison</h1>
      </header>

      {/* Timing Statistics Panel */}
      <div className="bg-slate-800 rounded-xl p-6 shadow-lg border-4 border-slate-900">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <ArrowsHorizontal size={24} className="text-white" weight="bold" />
          Block Timing Statistics
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-700 p-4 rounded-lg text-white">
            <div className="text-center text-2xl font-bold">{timingStats.total}</div>
            <div className="text-center text-sm">Total Blocks Compared</div>
          </div>
          
          <div className="bg-slate-700 p-4 rounded-lg text-green-300">
            <div className="text-center text-2xl font-bold">{timingStats.flashFaster}</div>
            <div className="text-center text-sm">Flash Blocks Faster</div>
            <div className="text-center text-xs mt-1">
              {timingStats.total > 0 ? `(${Math.round(timingStats.flashFaster / timingStats.total * 100)}%)` : '(0%)'}
            </div>
          </div>
          
          <div className="bg-slate-700 p-4 rounded-lg text-blue-300">
            <div className="text-center text-2xl font-bold">{timingStats.baseFaster}</div>
            <div className="text-center text-sm">Base Blocks Faster</div>
            <div className="text-center text-xs mt-1">
              {timingStats.total > 0 ? `(${Math.round(timingStats.baseFaster / timingStats.total * 100)}%)` : '(0%)'}
            </div>
          </div>
          
          <div className="bg-slate-700 p-4 rounded-lg text-yellow-300">
            <div className="text-center text-2xl font-bold">{timingStats.equal}</div>
            <div className="text-center text-sm">Received Simultaneously</div>
            <div className="text-center text-xs mt-1">
              {timingStats.total > 0 ? `(${Math.round(timingStats.equal / timingStats.total * 100)}%)` : '(0%)'}
            </div>
          </div>
        </div>
        
        {timingStats.total > 0 && (
          <div className="mt-4 bg-slate-700 p-4 rounded-lg">
            <div className="h-6 w-full bg-slate-600 rounded-full overflow-hidden">
              <div className="flex h-full">
                <div 
                  className="bg-green-500 h-full" 
                  style={{ width: `${Math.round(timingStats.flashFaster / timingStats.total * 100)}%` }}
                />
                <div 
                  className="bg-yellow-500 h-full" 
                  style={{ width: `${Math.round(timingStats.equal / timingStats.total * 100)}%` }}
                />
                <div 
                  className="bg-blue-500 h-full" 
                  style={{ width: `${Math.round(timingStats.baseFaster / timingStats.total * 100)}%` }}
                />
              </div>
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span className="text-green-300">Flash Faster</span>
              <span className="text-yellow-300">Equal</span>
              <span className="text-blue-300">Base Faster</span>
            </div>
          </div>
        )}
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
              <div>Total messages received: {flashMessagesCount}</div>
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
              <div>Total messages received: {baseMessagesCount}</div>
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

      {/* Comparison Section */}
      <div className="bg-slate-800 rounded-xl p-6 shadow-lg border-4 border-slate-900 mt-6">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <ArrowsHorizontal size={24} className="text-white" weight="bold" />
          Block Comparison
        </h2>
        
        <div className="space-y-4 overflow-y-auto max-h-[500px]">
          <AnimatePresence>
            {allBlocks.map((blockData, index) => {
              const flashBlock = blockData.flash;
              const baseBlock = blockData.base;
              const hasFlash = !!flashBlock;
              const hasBase = !!baseBlock;
              const blockNumber = blockData.number;
              
              // Calculate which one was faster
              const timing = blockTimings[blockNumber] || {};
              let timingResult = null;
              let timingDiff = null;
              
              if (timing.flash && timing.base) {
                timingDiff = Math.abs(timing.flash - timing.base);
                if (timing.flash < timing.base - 50) {
                  timingResult = 'flash';
                } else if (timing.base < timing.flash - 50) {
                  timingResult = 'base';
                } else {
                  timingResult = 'equal';
                }
              }
              
              return (
                <motion.div
                  key={`compare-${blockNumber}-${index}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-slate-700 p-4 rounded-lg text-white font-mono text-sm"
                >
                  <div className="text-center mb-2 text-lg font-bold">Block #{blockNumber}</div>
                  
                  {timingResult && (
                    <div className={`text-center mb-2 text-sm ${
                      timingResult === 'flash' ? 'text-green-300' : 
                      timingResult === 'base' ? 'text-blue-300' : 
                      'text-yellow-300'
                    }`}>
                      {timingResult === 'flash' && (
                        <span>Flash received {timingDiff}ms faster ⚡</span>
                      )}
                      {timingResult === 'base' && (
                        <span>Base received {timingDiff}ms faster ⚡</span>
                      )}
                      {timingResult === 'equal' && (
                        <span>Received simultaneously (±50ms)</span>
                      )}
                    </div>
                  )}
                  
                  <div className="grid grid-cols-3 gap-2">
                    <div className="font-bold"></div>
                    <div className="font-bold text-green-300 text-center">FLASH</div>
                    <div className="font-bold text-blue-300 text-center">BASE</div>
                    
                    <div>HASH</div>
                    <div className={`truncate text-center ${!hasFlash && 'text-gray-500'}`}>
                      {hasFlash ? flashBlock.hash : 'N/A'}
                    </div>
                    <div className={`truncate text-center ${!hasBase && 'text-gray-500'}`}>
                      {hasBase ? baseBlock.hash : 'N/A'}
                    </div>
                    
                    <div>TIMESTAMP</div>
                    <div className={`text-center ${!hasFlash && 'text-gray-500'}`}>
                      {hasFlash ? new Date(flashBlock.timestamp * 1000).toLocaleTimeString() : 'N/A'}
                    </div>
                    <div className={`text-center ${!hasBase && 'text-gray-500'}`}>
                      {hasBase ? new Date(baseBlock.timestamp * 1000).toLocaleTimeString() : 'N/A'}
                    </div>
                    
                    <div>TRANSACTIONS</div>
                    <div className={`text-center ${!hasFlash && 'text-gray-500'}`}>
                      {hasFlash ? flashBlock.transactions : 'N/A'}
                    </div>
                    <div className={`text-center ${!hasBase && 'text-gray-500'}`}>
                      {hasBase ? baseBlock.transactions : 'N/A'}
                    </div>
                    
                    <div>GAS USED</div>
                    <div className={`text-center ${!hasFlash && 'text-gray-500'}`}>
                      {hasFlash ? flashBlock.gasUsed : 'N/A'}
                    </div>
                    <div className={`text-center ${!hasBase && 'text-gray-500'}`}>
                      {hasBase ? baseBlock.gasUsed : 'N/A'}
                    </div>
                    
                    <div>BASE FEE</div>
                    <div className={`text-center ${!hasFlash && 'text-gray-500'}`}>
                      {hasFlash ? `${flashBlock.baseFeePerGas} wei` : 'N/A'}
                    </div>
                    <div className={`text-center ${!hasBase && 'text-gray-500'}`}>
                      {hasBase ? `${baseBlock.baseFeePerGas} wei` : 'N/A'}
                    </div>
                    
                    <div>RECEIVED AT</div>
                    <div className={`text-center ${!hasFlash && 'text-gray-500'}`}>
                      {hasFlash && timing.flash ? new Date(timing.flash).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3}) : 'N/A'}
                    </div>
                    <div className={`text-center ${!hasBase && 'text-gray-500'}`}>
                      {hasBase && timing.base ? new Date(timing.base).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3}) : 'N/A'}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
