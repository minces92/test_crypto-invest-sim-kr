import { NextResponse } from 'next/server';

export class AppError extends Error {
    constructor(
        public code: string,
        message: string,
        public statusCode: number = 500
    ) {
        super(message);
        this.name = 'AppError';
    }
}

export function handleApiError(error: unknown) {
    if (error instanceof AppError) {
        return NextResponse.json(
            { code: error.code, message: error.message },
            { status: error.statusCode }
        );
    }

    console.error('Unexpected error:', error);
    return NextResponse.json(
        { code: 'INTERNAL_ERROR', message: '서버 오류' },
        { status: 500 }
    );
}
