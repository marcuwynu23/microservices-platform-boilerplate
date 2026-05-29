export const EXCHANGES = {
  PLATFORM_EVENTS: 'platform.events'
};

export const ROUTING_KEYS = {
  POST_CREATED: 'post.created',
  POST_UPDATED: 'post.updated',
  POST_DELETED: 'post.deleted',
  FILE_UPLOADED: 'file.uploaded',
  FILE_DELETED: 'file.deleted',
  NOTIFICATION_CREATED: 'notification.created'
} as const;

export interface BaseEventPayload {
  eventId: string;
  timestamp: string;
}

export interface PostCreatedEvent extends BaseEventPayload {
  postId: string;
  title: string;
  content: string;
  authorId: string;
}

export interface PostUpdatedEvent extends BaseEventPayload {
  postId: string;
  title?: string;
  content?: string;
}

export interface PostDeletedEvent extends BaseEventPayload {
  postId: string;
}

export interface FileUploadedEvent extends BaseEventPayload {
  fileId: string;
  filename: string;
  url: string;
  mimetype: string;
  size: number;
}

export interface FileDeletedEvent extends BaseEventPayload {
  fileId: string;
}

export interface NotificationCreatedEvent extends BaseEventPayload {
  notificationId: string;
  userId: string;
  type: 'email' | 'push' | 'in-app';
  title: string;
  message: string;
}
