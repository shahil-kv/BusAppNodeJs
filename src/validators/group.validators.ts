import { body } from "express-validator";

// Validation middleware for manage group operations
const validateManageGroup = [
    body('userId')
        .trim()
        .notEmpty()
        .withMessage('User ID is required'),

    body('opsMode')
        .isIn(['INSERT', 'UPDATE', 'DELETE'])
        .withMessage('Invalid operation mode'),

    body('groupId')
        .if(body('opsMode').custom((value) => value === 'UPDATE' || value === 'DELETE'))
        .notEmpty()
        .withMessage('Group ID is required for update or delete operations'),

    body('groupName')
        .if(body('opsMode').custom((value) => value === 'INSERT' || value === 'UPDATE'))
        .trim()
        .notEmpty()
        .withMessage('Group name is required'),

    body('contacts')
        .if(body('opsMode').custom((value) => value === 'INSERT' || value === 'UPDATE'))
        .isArray()
        .withMessage('Contacts must be an array'),

    body('contacts.*.name')
        .if(body('opsMode').custom((value) => value === 'INSERT' || value === 'UPDATE'))
        .trim()
        .notEmpty()
        .withMessage('Contact name is required'),

    body('contacts.*.phoneNumber')
        .if(body('opsMode').custom((value) => value === 'INSERT' || value === 'UPDATE'))
        .trim()
        .notEmpty()
        .withMessage('Contact phone number is required')
];

export { validateManageGroup };