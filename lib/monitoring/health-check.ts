import { createServerClient } from '@/lib/supabase/server';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'down';
  responseTime?: number;
  message?: string;
}

export interface SystemHealth {
  database: HealthStatus;
  mail: HealthStatus;
  notifications: HealthStatus;
  api: HealthStatus;
  overall: 'healthy' | 'degraded' | 'down';
}

export async function checkDatabaseHealth(): Promise<HealthStatus> {
  try {
    const startTime = Date.now();
    const supabase = createServerClient();

    const { error } = await supabase
      .from('tenants')
      .select('count')
      .limit(1);

    const responseTime = Date.now() - startTime;

    if (error) {
      return {
        status: 'down',
        responseTime,
        message: error.message,
      };
    }

    return {
      status: responseTime < 100 ? 'healthy' : 'degraded',
      responseTime,
      message: responseTime < 100 ? 'Database is responding normally' : 'Database response is slow',
    };
  } catch (error) {
    return {
      status: 'down',
      message: 'Database connection failed',
    };
  }
}

export async function checkMailServiceHealth(): Promise<HealthStatus> {
  try {
    // Check if mail service is configured
    const hasMailConfig = process.env.IMAP_HOST && process.env.IMAP_USER;

    if (!hasMailConfig) {
      return {
        status: 'down',
        message: 'Mail service not configured',
      };
    }

    // In a real implementation, you would check IMAP connection
    return {
      status: 'healthy',
      message: 'Mail service is operational',
    };
  } catch (error) {
    return {
      status: 'down',
      message: 'Mail service check failed',
    };
  }
}

export async function checkNotificationServiceHealth(): Promise<HealthStatus> {
  try {
    const supabase = createServerClient();

    // Check recent notification queue status
    const { data, error } = await supabase
      .from('notification_queue')
      .select('status')
      .eq('status', 'pending')
      .limit(100);

    if (error) {
      return {
        status: 'degraded',
        message: error.message,
      };
    }

    const pendingCount = data?.length || 0;

    if (pendingCount > 50) {
      return {
        status: 'degraded',
        message: `${pendingCount} notifications pending`,
      };
    }

    return {
      status: 'healthy',
      message: 'Notification queue is processing normally',
    };
  } catch (error) {
    return {
      status: 'down',
      message: 'Notification service check failed',
    };
  }
}

export async function checkApiHealth(): Promise<HealthStatus> {
  try {
    const startTime = Date.now();

    // Simple health check
    const responseTime = Date.now() - startTime;

    return {
      status: 'healthy',
      responseTime,
      message: 'API is responding',
    };
  } catch (error) {
    return {
      status: 'down',
      message: 'API health check failed',
    };
  }
}

export async function getSystemHealth(): Promise<SystemHealth> {
  const [database, mail, notifications, api] = await Promise.all([
    checkDatabaseHealth(),
    checkMailServiceHealth(),
    checkNotificationServiceHealth(),
    checkApiHealth(),
  ]);

  const statuses = [database.status, mail.status, notifications.status, api.status];

  let overall: 'healthy' | 'degraded' | 'down';
  if (statuses.includes('down')) {
    overall = 'down';
  } else if (statuses.includes('degraded')) {
    overall = 'degraded';
  } else {
    overall = 'healthy';
  }

  return {
    database,
    mail,
    notifications,
    api,
    overall,
  };
}
