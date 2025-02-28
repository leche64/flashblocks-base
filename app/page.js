"use client";

import { useEffect, useState, useMemo } from "react";
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
  
  // Constants
  const RACE_TARGET = 420;
  const MAX_DISPLAYED_BLOCKS = 5;
  const TIMING_THRESHOLD_MS = 50;
  
  // Handle Flash WebSocket messages
  const handleFlashMessage = async (event) => {
    setFlashMessagesCount(prev => prev + 1);
    
    try {
      const text = event.data instanceof Blob ? await event.data.text() : event.data;
      const data = JSON.parse(text);
      
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
      
      updateBlockTimings(blockInfo.number, 'flash', blockInfo.receivedAt);
      addNewBlock(blockInfo, setFlashBlocks, setTotalFlashBlocks);
    } catch (error) {
      console.error("Failed to parse Flash websocket message:", error);
    }
  };
  
  // Handle Base WebSocket messages
  const handleBaseMessage = async (event) => {
    setBaseMessagesCount(prev => prev + 1);
    
    try {
      const text = event.data instanceof Blob ? await event.data.text() : event.data;
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
      
      updateBlockTimings(blockInfo.number, 'base', blockInfo.receivedAt);
      addNewBlock(blockInfo, setBaseBlocks, setTotalBaseBlocks);
    } catch (error) {
      console.error("Failed to parse Base websocket message:", error);
    }
  };
  
  // Helper function to update block timings
  const updateBlockTimings = (blockNumber, source, timestamp) => {
    setBlockTimings(prev => ({
      ...prev,
      [blockNumber]: {
        ...prev[blockNumber],
        [source]: timestamp
      }
    }));
  };
  
  // Helper function to add a new block to the state
  const addNewBlock = (blockInfo, setBlocksFunction, setTotalFunction) => {
    setBlocksFunction(prev => {
      // Check if block already exists in the array
      if (prev.some(block => block.number === blockInfo.number)) {
        return prev; // Skip adding duplicate block
      }
      
      // Increment total blocks counter
      setTotalFunction(current => current + 1);
      
      return [blockInfo, ...prev].slice(0, MAX_DISPLAYED_BLOCKS);
    });
  };
  
  // Flash Blocks WebSocket
  const { lastMessage: flashLastMessage } = useWebSocket("wss://sepolia.flashblocks.base.org/ws", {
    onOpen: () => setIsFlashConnected(true),
    onClose: () => setIsFlashConnected(false),
    onError: () => setIsFlashConnected(false),
    onMessage: handleFlashMessage,
    reconnectAttempts: 10,
    reconnectInterval: 3000,
    shouldReconnect: () => true,
  });

  // Base Blocks WebSocket
  const { lastMessage: baseLastMessage, readyState: baseReadyState, sendMessage: baseSendMessage } = useWebSocket("wss://base-sepolia-rpc.publicnode.com", {
    onOpen: () => {
      console.log("Base WebSocket connected successfully");
      setIsBaseConnected(true);
      setBaseLastError(null);
      
      // Add a small delay before sending the subscription message
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
    onMessage: handleBaseMessage,
    reconnectAttempts: 10,
    reconnectInterval: 3000,
    shouldReconnect: (closeEvent) => {
      setBaseConnectionAttempts(prev => prev + 1);
      console.log("Base WebSocket attempting to reconnect", closeEvent);
      return true;
    },
  });

  // Combine and sort blocks for comparison
  const allBlocks = useMemo(() => {
    return [...flashBlocks, ...baseBlocks]
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
      .slice(0, MAX_DISPLAYED_BLOCKS);
  }, [flashBlocks, baseBlocks]);

  // Calculate timing statistics
  const timingStats = useMemo(() => {
    const stats = {
      flashFaster: 0,
      baseFaster: 0,
      equal: 0,
      total: 0
    };

    Object.values(blockTimings).forEach(timing => {
      if (timing.flash && timing.base) {
        stats.total++;
        const diff = timing.flash - timing.base;
        if (diff < -TIMING_THRESHOLD_MS) { // Flash is faster
          stats.flashFaster++;
        } else if (diff > TIMING_THRESHOLD_MS) { // Base is faster
          stats.baseFaster++;
        } else { // Roughly equal
          stats.equal++;
        }
      }
    });
    
    return stats;
  }, [blockTimings]);

  // Check for race winner based on message counts
  useEffect(() => {
    if (raceWinner) return; // Race already has a winner
    
    if (flashMessagesCount >= RACE_TARGET && baseMessagesCount < RACE_TARGET) {
      setRaceWinner('flash');
    } else if (baseMessagesCount >= RACE_TARGET && flashMessagesCount < RACE_TARGET) {
      setRaceWinner('base');
    } else if (flashMessagesCount >= RACE_TARGET && baseMessagesCount >= RACE_TARGET) {
      // Both reached the goal at the same time (or in the same render cycle)
      setRaceWinner('tie');
    }
  }, [flashMessagesCount, baseMessagesCount, raceWinner]);

  // UI Components
  const RaceTrack = ({ source, messageCount, color }) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-white mb-1">
        <div className={`h-3 w-3 bg-${color}-400 rounded-full`}></div>
        <span>{source}: {messageCount} blocks</span>
      </div>
      
      <div className="relative h-8 bg-slate-700 rounded-lg overflow-hidden">
        {/* Finish Line */}
        <div className="absolute right-0 top-0 bottom-0 w-1 bg-white z-10 flex items-center justify-center">
          <div className="absolute -left-7 text-white font-bold">{RACE_TARGET}</div>
        </div>
        
        {/* Progress Markers */}
        {[100, 200, 300].map(marker => (
          <div 
            key={`${source.toLowerCase()}-${marker}`} 
            className="absolute top-0 bottom-0 w-px bg-slate-600 z-0 flex items-center justify-center"
            style={{ left: `${(marker / RACE_TARGET) * 100}%` }}
          >
            <div className="absolute -left-4 text-slate-400 text-sm">{marker}</div>
          </div>
        ))}
        
        {/* Progress Bar - Using style instead of animate for smoother transitions */}
        <div 
          className={`absolute top-0 left-0 bottom-0 bg-${color}-500/30 z-0 transition-all duration-300 ease-out`}
          style={{ width: `${Math.min((messageCount / RACE_TARGET) * 100, 100)}%` }}
        />
        
        {/* Message Ticks - Reduce number of ticks and use memo to prevent re-renders */}
        <div className="absolute top-0 left-0 bottom-0 w-full">
          {useMemo(() => {
            // Only show every 5th tick for better performance
            const ticksToShow = Math.min(Math.floor(messageCount / 5), 20);
            return Array.from({ length: ticksToShow }, (_, i) => (
              <div
                key={`${source.toLowerCase()}-tick-${i}`}
                className={`absolute top-0 bottom-0 w-0.5 bg-${color}-400 z-5`}
                style={{ 
                  left: `${Math.min(((messageCount - i * 5) / RACE_TARGET) * 100, 100)}%`,
                  opacity: 1 - (i / 20) * 0.8 // Fade out older ticks
                }}
              />
            ));
          }, [messageCount, source, color])}
        </div>
        
        {/* Racer - Using style for position instead of animate */}
        <div 
          className={`absolute top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-${color}-400 shadow-lg z-20 flex items-center justify-center transition-all duration-300 ease-out`}
          style={{ 
            left: `${Math.min((messageCount / RACE_TARGET) * 100, 100)}%`,
          }}
        >
          <span className="text-xs font-bold">{source.charAt(0)}</span>
          {raceWinner === source.toLowerCase() && (
            <motion.div 
              className={`absolute -top-8 whitespace-nowrap text-${color}-300 font-bold`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              WINNER!
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );

  const BlockPanel = ({ title, isConnected, blocks, color, messageCount, connectionInfo }) => (
    <div className="bg-slate-800 rounded-xl p-6 shadow-lg border-4 border-slate-900 flex flex-col">
      <div className={`${isConnected ? 'bg-green-300' : 'bg-yellow-300'} p-4 rounded-lg font-mono text-sm mb-4 shadow-inner`}>
        <div className="flex justify-between items-center">
          <span>{title}: {isConnected ? 'CONNECTED' : 'CONNECTING...'}</span>
          <div className={`h-2 w-2 ${isConnected ? 'bg-green-600' : 'bg-yellow-600'} rounded-full animate-pulse`} />
        </div>
        <div className="mt-2 text-xs text-slate-800">
          <div>Total blocks received: {messageCount}</div>
          {connectionInfo}
        </div>
      </div>

      <div className="space-y-4 overflow-y-auto flex-grow max-h-[500px]">
        {/* Use a stable key based only on block number to prevent re-renders */}
        {blocks.map((block) => (
          <div
            key={`${color}-${block.number}`}
            className={`bg-slate-700 p-4 rounded-lg text-${color}-300 font-mono text-sm`}
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
          </div>
        ))}
      </div>
    </div>
  );

  // Base connection info component
  const baseConnectionInfoComponent = !isBaseConnected ? (
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
  ) : null;

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
          Block Race - First to {RACE_TARGET} Blocks Wins!
        </h2>
        
        <div className="space-y-6">
          {/* Flash Blocks Track */}
          <RaceTrack source="Flash" messageCount={flashMessagesCount} color="green" />
          
          {/* Base Blocks Track */}
          <RaceTrack source="Base" messageCount={baseMessagesCount} color="blue" />
          
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
        <BlockPanel 
          title="FLASH BLOCKS"
          isConnected={isFlashConnected}
          blocks={flashBlocks}
          color="green"
          messageCount={flashMessagesCount}
          connectionInfo={null}
        />

        {/* Base Blocks Panel */}
        <BlockPanel 
          title="BASE BLOCKS"
          isConnected={isBaseConnected}
          blocks={baseBlocks}
          color="blue"
          messageCount={baseMessagesCount}
          connectionInfo={baseConnectionInfoComponent}
        />
      </div>
    </div>
  );
}
