import { body } from 'express-validator';

const validateCall = [
    body('userId')
        .trim()
        .notEmpty()
        .withMessage('User ID is required')
        .isNumeric()
        .withMessage('User ID must be a number'),

    body('groupId')
        .not()
        .isEmpty()
        .withMessage('Group ID is required')
        .isInt({ min: 0 })
        .withMessage('Group ID must be a non-negative integer'),

    body('groupType')
        .trim()
        .notEmpty()
        .withMessage('Group type is required')
        .isIn(['MANUAL', 'USER_DEFINED'])
        .withMessage('Invalid group type'),

    // Only validate contacts if it's a manual call
    body('contacts')
        .if(body('groupType').equals('MANUAL'))
        .isArray({ min: 1 })
        .withMessage('Contacts must be a non-empty array for manual calls'),

    body('contacts.*.name')
        .if(body('groupType').equals('MANUAL'))
        .trim()
        .notEmpty()
        .withMessage('Each contact must have a name'),

    body('contacts.*.phoneNumber')
        .if(body('groupType').equals('MANUAL'))
        .trim()
        .notEmpty()
        .withMessage('Each contact must have a phone number'),
];

export { validateCall };
