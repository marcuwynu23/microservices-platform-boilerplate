export interface CreatePostDTO {
  title: string;
  content: string;
  authorId: string;
}

export interface UpdatePostDTO {
  title?: string;
  content?: string;
}

export interface PostResponseDTO {
  id: string;
  title: string;
  content: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface FileResponseDTO {
  id: string;
  filename: string;
  url: string;
  mimetype: string;
  size: number;
  uploadedAt: string;
}

export interface CreateNotificationDTO {
  userId: string;
  type: 'email' | 'push' | 'in-app';
  title: string;
  message: string;
}

export interface NotificationResponseDTO {
  id: string;
  userId: string;
  type: 'email' | 'push' | 'in-app';
  title: string;
  message: string;
  status: 'sent' | 'failed' | 'pending';
  createdAt: string;
}
