import { useEffect, useRef, useState } from 'react';

/**
 * useWebSocket(url)
 *
 * Returns { connected, lastMessage }
 *   - connected    : boolean — current connection state
 *   - lastMessage  : object  — last parsed JSON message from the server
 *
 * Auto-reconnects with exponential backoff (max 30 s) when the socket
 * closes unexpectedly.  Pass url=null/undefined to disable.
 */
export function useWebSocket(url) {
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);

  const socketRef   = useRef(null);
  const retryDelay  = useRef(1000);   // start at 1 s
  const retryTimer  = useRef(null);
  const unmounted   = useRef(false);

  useEffect(() => {
    if (!url) return undefined;

    unmounted.current = false;

    function connect() {
      if (unmounted.current) return;

      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => {
        if (unmounted.current) return;
        setConnected(true);
        retryDelay.current = 1000; // reset backoff on success
      };

      socket.onmessage = (event) => {
        if (unmounted.current) return;
        try {
          const parsed = JSON.parse(event.data);
          setLastMessage(parsed);
        } catch {
          // non-JSON frame — ignore
        }
      };

      socket.onclose = (event) => {
        if (unmounted.current) return;
        setConnected(false);
        // Only reconnect if it wasn't a clean intentional close (code 1000)
        if (event.code !== 1000) {
          retryTimer.current = setTimeout(() => {
            retryDelay.current = Math.min(retryDelay.current * 2, 30_000);
            connect();
          }, retryDelay.current);
        }
      };

      socket.onerror = () => {
        socket.close();
      };
    }

    connect();

    return () => {
      unmounted.current = true;
      clearTimeout(retryTimer.current);
      socketRef.current?.close(1000, 'component unmounted');
    };
  }, [url]);

  return { connected, lastMessage };
}
