# Real-time Notifications Configuration

This document outlines the configuration options for Supabase real-time notifications in the Mataresit application.

## Environment Variables

### Core Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_DISABLE_REALTIME` | `false` | Completely disable real-time notifications (forces fallback mode) |
| `VITE_ENABLE_REALTIME` | `true` | Enable/disable real-time in production environments |
| `VITE_SHOW_REALTIME_STATUS` | `false` | Show toast notifications about real-time status changes |

### Advanced Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_REALTIME_HEARTBEAT_INTERVAL` | `30000` | Heartbeat interval in milliseconds |
| `VITE_REALTIME_MAX_RETRIES` | `3` | Maximum reconnection attempts before fallback |
| `VITE_REALTIME_DEBUG` | `false` | Enable detailed real-time logging in production |

## Database Configuration

The following tables are configured for real-time updates:

- `notifications` - User notifications and status updates
- `receipts` - Receipt processing status changes
- `processing_logs` - Real-time processing logs

### Publications

All real-time tables are added to the `supabase_realtime` publication:

```sql
-- Check current publication tables
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';
```

### Row Level Security (RLS)

All real-time tables have RLS enabled with user-specific policies:

- Users can only receive real-time updates for their own data
- Team-based filtering is applied where applicable
- Proper authentication is required for all subscriptions

## Client Configuration

The Supabase client is configured with optimized real-time settings:

```typescript
// Automatic reconnection with exponential backoff
reconnectAfterMs: (tries: number) => Math.min(1000 * Math.pow(2, tries), 30000)

// Heartbeat to keep connection alive
heartbeatIntervalMs: 30000

// Event rate limiting
eventsPerSecond: 10
```

## Fallback Behavior

When real-time is unavailable, the application automatically:

1. Switches to manual refresh mode
2. Maintains full functionality
3. Shows appropriate user feedback (in development)
4. Continues to attempt reconnection with backoff

## Production Deployment

For production environments:

1. Ensure `VITE_ENABLE_REALTIME=true` (default)
2. Set appropriate heartbeat intervals based on infrastructure
3. Monitor connection logs for issues
4. Consider setting `VITE_REALTIME_DEBUG=true` for troubleshooting

## Troubleshooting

### Common Issues

1. **Connection Timeouts**: Increase `VITE_REALTIME_HEARTBEAT_INTERVAL`
2. **Frequent Disconnections**: Check network stability and firewall settings
3. **Missing Updates**: Verify RLS policies and table publications
4. **High Resource Usage**: Reduce `eventsPerSecond` or increase heartbeat interval

### Debug Mode

Enable debug logging with:
```bash
VITE_REALTIME_DEBUG=true
```

This will show detailed connection logs and subscription status updates.
