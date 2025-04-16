import { body } from "express-validator";

const refreshTokenValidation = () => {
    return [
        body("refreshToken")
            .trim()
            .notEmpty()
            .withMessage("Refresh token is required")
            .isJWT()
            .withMessage("Invalid refresh token format")
    ];
};

const logoutValidation = () => {
    return [
        body("refreshToken")
            .trim()
            .notEmpty()
            .withMessage("Refresh token is required")
            .isJWT()
            .withMessage("Invalid refresh token format")
    ];
};

export { refreshTokenValidation, logoutValidation }; 