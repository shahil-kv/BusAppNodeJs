import { Router } from "express";
import {
  BusOwnerRegistration,
  GetBusOwners,
  loginBusOwner,
} from "../controllers/user.controller";
import passport from "passport";
import {
  busOwnerLoginValidator,
  busOwnerRegisteration,
} from "../validators/auth/user.validate";
import { validate } from "../validators/validate";
const router = Router();

//unsecured routes
router.route("/bus-owners").get(GetBusOwners);
router
  .route("/register-busowner")
  .post(busOwnerRegisteration(), validate, BusOwnerRegistration);

router
  .route("/login-busowner")
  .get(busOwnerLoginValidator(), validate, loginBusOwner);

// router.route("/login").post(userLoginValidator(), validate, loginUser);

//secured routes
// router.route("/logout").post(verifyJWT, logoutUser);

// SSO routes
router.route("/google").get(
  passport.authenticate("google", {
    scope: ["profile", "email"],
  }),
  (req, res) => {
    res.send("redirecting to google...");
  }
);

// router
//   .route("/google/callback")
//   .get(passport.authenticate("google"), handleSocialLogin);
export default router;
