import React, { useState } from "react";
import * as Yup from "yup";
import { Formik, Form, Field, ErrorMessage } from "formik";
import { motion, AnimatePresence } from "framer-motion";
import api from "../api";
import { useNavigate } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import { Eye, EyeClosed } from "lucide-react";
import { useContext } from "react";
import { AuthContext } from "../AuthContext";

const UserAuth = () => {
  const {updateAuth} = useContext(AuthContext)
  const [isLogin, setIsLogin] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const navigate = useNavigate();

  const loginValidationSchema = Yup.object().shape({
    username: Yup.string()
      .required("Username is required")
      .min(4, "Username must be at least 3 characters."),
    password: Yup.string()
      .required("Password is required.")
      .min(6, "Password must be at least 6 characters"),
  });

  const SignUpValidationSchema = Yup.object().shape({
    username: Yup.string()
      .required("Username is required")
      .min(4, "Username must be at least 3 characters."),
    first_name: Yup.string().required("First name is required."),
    last_name: Yup.string().required("Last name is required."),
    password1: Yup.string()
      .required("Password is required.")
      .min(6, "Password must be at least 6 characters")
      .matches(
        /^(?=.*[A-Za-z])(?=.*\d).{6,}$/,
        "Password must have at least 6 characters, including a letter and a number."
      ),
    password2: Yup.string()
      .oneOf([Yup.ref("password1"), null], "Password must match.")
      .required("Confirm password is required."),
  });

  const handleLogin = async (values, { setSubmitting }) => {
    try {
      const response = await api.post("users/signin/", values);
      if (response.status === 200) {
        localStorage.setItem("access_token", response.data.access_token);
        localStorage.setItem("refresh_token", response.data.refresh_token);
        localStorage.setItem("user", JSON.stringify(response.data.user));
        updateAuth({
          accessToken: response.data.access_token,
          refreshToken: response.data.refresh_token,
          user: response.data.user,
        });

        navigate("/home/");

      }
    } catch (error) {
      if (error.response && error.response.data) {
        const errorData = error.response.data;
        Object.entries(errorData).forEach(([field, message]) => {
          toast.error(message);
        });
      } else {
        toast.error("Invalid Credentials.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (values, { setSubmitting, setFieldError }) => {
    try {
      const signupData = {
        username: values.username,
        first_name: values.first_name,
        last_name: values.last_name,
        password: values.password1,
        password2: values.password1,
      };
      const res = await api.post("users/signup/", signupData);
      if (res.status === 201) {
        toast.success("Sign up successful! Please log in.");
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        setIsLogin(true);
      }
    } catch (error) {
      if (error.response && error.response.data) {
        const errors = error.response.data;
        Object.entries(errors).forEach(([field, message]) => {
          const formikField = field === "password" ? "password1" : field;
          toast.error(`${field}: ${message}`);
          setFieldError(formikField, message);
        });
      } else {
        toast.error("An unexpected error occurred.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Container animation variants
  const containerVariants = {
    hidden: {
      opacity: 0,
      scale: 0.8,
      rotate: -10,
    },
    visible: {
      opacity: 1,
      scale: 1,
      rotate: 0,
      transition: {
        type: "spring",
        stiffness: 120,
        damping: 10,
        duration: 0.5,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.8,
      rotate: 10,
      transition: {
        duration: 0.3,
      },
    },
  };

  const buttonVariants = {
    rest: { scale: 1 },
    hover: {
      scale: 1.05,
      transition: {
        type: "spring",
        stiffness: 300,
      },
    },
    tap: { scale: 0.95 },
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-blue-300 to-purple-600 p-5">
      <Toaster position="top-right" />
      <AnimatePresence mode="wait">
        <motion.div
          key={isLogin ? "login" : "signup"}
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden"
        >
          <div className="p-8">
            <motion.h2
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-center font-mono font-bold text-3xl mb-6 text-gray-800"
            >
              {isLogin ? "SIGN IN" : "SIGN UP"}
            </motion.h2>

            {isLogin ? (
              <Formik
                initialValues={{ username: "", password: "" }}
                validationSchema={loginValidationSchema}
                onSubmit={handleLogin}
              >
                {({ isSubmitting }) => (
                  <Form className="space-y-4">
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      <Field
                        type="text"
                        name="username"
                        placeholder="Username"
                        className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <ErrorMessage
                        name="username"
                        component="div"
                        className="text-red-500 text-sm mt-1 ml-4"
                      />
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 }}
                    >
                      <div className="relative">
                        <Field
                          type={isVisible ? "text" : "password"}
                          name="password"
                          placeholder="Password"
                          className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <span
                          onClick={() => setIsVisible(!isVisible)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer"
                        >
                          {!isVisible ? (
                            <EyeClosed size={20} />
                          ) : (
                            <Eye size={20} />
                          )}
                        </span>
                      </div>
                      <ErrorMessage
                        name="password"
                        component="div"
                        className="text-sm text-red-500 ml-4 mt-1"
                      />
                    </motion.div>
                    <motion.div
                      className="flex items-center justify-center"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                    >
                      <motion.button
                        variants={buttonVariants}
                        initial="rest"
                        whileHover="hover"
                        whileTap="tap"
                        type="submit"
                        className="rounded-lg px-3.5 py-2 m-1 overflow-hidden relative group cursor-pointer border-2 font-medium border-indigo-600"
                      >
                        <span className="absolute w-64 h-0 transition-all duration-300 origin-center rotate-45 -translate-x-20 bg-indigo-600 top-1/2 group-hover:h-64 group-hover:-translate-y-32 ease"></span>
                        <span className="relative text-base font-semibold text-indigo-600 transition duration-300 group-hover:text-white ease">
                          {isSubmitting ? "Logging in..." : "Login"}
                        </span>
                      </motion.button>
                    </motion.div>
                  </Form>
                )}
              </Formik>
            ) : (
              <Formik
                initialValues={{
                  username: "",
                  first_name: "",
                  last_name: "",
                  password1: "",
                  password2: "",
                }}
                validationSchema={SignUpValidationSchema}
                onSubmit={handleRegister}
              >
                {({ isSubmitting, setFieldError }) => (
                  <Form className="space-y-4">
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      <Field
                        type="text"
                        name="username"
                        placeholder="Username"
                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <ErrorMessage
                        name="username"
                        component="div"
                        className="text-red-500 text-sm mt-1"
                      />
                    </motion.div>

                    {/* First Name and Last Name in the same line */}
                    <motion.div
                      className="flex space-x-4"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.35 }}
                    >
                      <div className="flex-1">
                        <Field
                          type="text"
                          name="first_name"
                          placeholder="First Name"
                          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <ErrorMessage
                          name="first_name"
                          component="div"
                          className="text-red-500 text-sm mt-1"
                        />
                      </div>
                      <div className="flex-1">
                        <Field
                          type="text"
                          name="last_name"
                          placeholder="Last Name"
                          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <ErrorMessage
                          name="last_name"
                          component="div"
                          className="text-red-500 text-sm mt-1"
                        />
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 }}
                    >
                      <Field
                        type={isVisible ? "text" : "password"}
                        name="password1"
                        placeholder="Password"
                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <ErrorMessage
                        name="password1"
                        component="div"
                        className="text-red-500 text-sm mt-1"
                      />
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 }}
                    >
                      <div className="relative">
                        <Field
                          type={isVisible ? "text" : "password"}
                          name="password2"
                          placeholder="Confirm Password"
                          className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <span
                          onClick={() => setIsVisible(!isVisible)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer"
                        >
                          {isVisible ? (
                            <EyeClosed size={20} />
                          ) : (
                            <Eye size={20} />
                          )}
                        </span>
                      </div>
                      <ErrorMessage
                        name="password"
                        component="div"
                        className="text-sm text-red-500 ml-4 mt-1"
                      />
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.6 }}
                    >
                      <motion.div
                        className="flex items-center justify-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                      >
                        <motion.button
                          variants={buttonVariants}
                          initial="rest"
                          whileHover="hover"
                          whileTap="tap"
                          type="submit"
                          disabled={isSubmitting}
                          className="rounded-lg px-3.5 py-2 m-1 overflow-hidden relative group cursor-pointer border-2 font-medium border-indigo-600"
                        >
                          <span className="absolute w-64 h-0 transition-all duration-300 origin-center rotate-45 -translate-x-20 bg-indigo-600 top-1/2 group-hover:h-64 group-hover:-translate-y-32 ease"></span>
                          <span className="relative text-base font-semibold text-indigo-600 transition duration-300 group-hover:text-white ease">
                            {isSubmitting ? "Signing up..." : "Sign Up"}
                          </span>
                        </motion.button>
                      </motion.div>
                    </motion.div>
                  </Form>
                )}
              </Formik>
            )}
            <motion.div
              className="text-center mt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-blue-500 hover:underline focus:outline-none"
              >
                {isLogin
                  ? "Don't have an account? Sign Up"
                  : "Already have an account? Login"}
              </button>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default UserAuth;
